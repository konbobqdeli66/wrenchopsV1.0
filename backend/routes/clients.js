const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkPermission } = require('../middleware/permissions');

const XLSX = require('xlsx');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 8 * 1024 * 1024, // 8MB
    },
});

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const runAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });

const allAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

const normalize = (v) => {
    const s = String(v ?? '').trim();
    return s;
};

const toNullIfEmpty = (v) => {
    const s = normalize(v);
    return s ? s : null;
};

const CLIENT_HEADERS_BG = [
    'ID',
    'Име*',
    'Email',
    'Телефон',
    'Град',
    'Адрес',
    'ЕИК',
    'ДДС №',
    'МОЛ',
    'Превозни средства',
];

const makeClientsWorkbook = (rows) => {
    const wb = XLSX.utils.book_new();
    const data = [CLIENT_HEADERS_BG];

    (rows || []).forEach((r) => {
        data.push([
            r?.id ?? '',
            r?.name ?? '',
            r?.email ?? '',
            r?.phone ?? '',
            r?.city ?? '',
            r?.address ?? '',
            r?.eik ?? '',
            r?.vat_number ?? '',
            r?.mol ?? '',
            r?.vehicles ?? '',
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Клиенти');

    const instr = XLSX.utils.aoa_to_sheet([
        ['ИНСТРУКЦИИ'],
        ['1) Попълнете/редактирайте редовете в лист "Клиенти".'],
        ['2) Колоните с * са задължителни.'],
        ['3) Ако има ID, записът ще се обнови. Ако ID е празно, ще се създаде нов клиент.'],
        ['4) Качете файла през бутона Import XLSX в системата.'],
    ]);
    XLSX.utils.book_append_sheet(wb, instr, 'ИНСТРУКЦИИ');

    return wb;
};

// --- XLSX (template/export/import) ---
// IMPORTANT: keep these routes BEFORE '/:id'

router.get('/xlsx/template', checkPermission('clients', 'read'), (req, res) => {
    try {
        const wb = makeClientsWorkbook([]);
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', XLSX_MIME);
        res.setHeader('Content-Disposition', 'attachment; filename="clients_template.xlsx"');
        return res.send(buf);
    } catch (e) {
        return res.status(500).json({ error: e?.message || 'XLSX export failed' });
    }
});

router.get('/xlsx/export', checkPermission('clients', 'read'), async (req, res) => {
    try {
        const rows = await allAsync('SELECT * FROM clients ORDER BY id ASC');
        const wb = makeClientsWorkbook(rows);
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', XLSX_MIME);
        res.setHeader('Content-Disposition', 'attachment; filename="clients_export.xlsx"');
        return res.send(buf);
    } catch (e) {
        return res.status(500).json({ error: e?.message || 'XLSX export failed' });
    }
});

router.post('/xlsx/import', checkPermission('clients', 'write'), upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file?.buffer?.length) {
            return res.status(400).json({ error: 'Missing XLSX file (field: file)' });
        }

        const wb = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames.includes('Клиенти') ? 'Клиенти' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        if (!ws) return res.status(400).json({ error: 'No worksheet found in XLSX' });

        // Read as arrays so we can enforce expected header order (Bulgarian template)
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const header = (aoa[0] || []).map((x) => String(x || '').trim());

        const expected = CLIENT_HEADERS_BG;
        const headerOk = expected.every((h, i) => (header[i] || '') === h);
        if (!headerOk) {
            return res.status(400).json({
                error: 'Невалиден шаблон. Моля използвайте XLSX шаблона от системата.',
                expectedHeader: expected,
                gotHeader: header,
            });
        }

        const dataRows = aoa.slice(1).filter((r) => (r || []).some((cell) => String(cell || '').trim() !== ''));
        if (dataRows.length === 0) {
            return res.json({ success: true, inserted: 0, updated: 0, skipped: 0, errors: [] });
        }

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        await runAsync('BEGIN IMMEDIATE TRANSACTION');
        try {
            for (let idx = 0; idx < dataRows.length; idx++) {
                const r = dataRows[idx] || [];
                const rowNo = idx + 2; // Excel row number (1-based, header is row 1)

                const idRaw = r[0];
                const name = normalize(r[1]);
                const email = toNullIfEmpty(r[2]);
                const phone = toNullIfEmpty(r[3]);
                const city = toNullIfEmpty(r[4]);
                const address = toNullIfEmpty(r[5]);
                const eik = toNullIfEmpty(r[6]);
                const vat_number = toNullIfEmpty(r[7]);
                const mol = toNullIfEmpty(r[8]);
                const vehicles = toNullIfEmpty(r[9]);

                if (!name) {
                    skipped++;
                    errors.push(`Ред ${rowNo}: липсва задължително поле "Име*".`);
                    continue;
                }

                const id = Number(String(idRaw || '').trim());
                if (Number.isFinite(id) && id > 0) {
                    const result = await runAsync(
                        `UPDATE clients
                         SET name = ?, email = ?, phone = ?, city = ?, address = ?, eik = ?, vat_number = ?, mol = ?, vehicles = ?
                         WHERE id = ?`,
                        [name, email, phone, city, address, eik, vat_number, mol, vehicles, id]
                    );
                    if (result.changes > 0) updated++;
                    else {
                        // If id not found -> insert as new
                        await runAsync(
                            'INSERT INTO clients (name, email, address, city, eik, vat_number, mol, phone, vehicles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [name, email, address, city, eik, vat_number, mol, phone, vehicles]
                        );
                        inserted++;
                    }
                } else {
                    await runAsync(
                        'INSERT INTO clients (name, email, address, city, eik, vat_number, mol, phone, vehicles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [name, email, address, city, eik, vat_number, mol, phone, vehicles]
                    );
                    inserted++;
                }
            }

            await runAsync('COMMIT');
        } catch (e) {
            await runAsync('ROLLBACK').catch(() => null);
            throw e;
        }

        return res.json({ success: true, inserted, updated, skipped, errors });
    } catch (e) {
        return res.status(500).json({ error: e?.message || 'XLSX import failed' });
    }
});

// Получаване на всички клиенти
router.get('/', checkPermission('clients', 'read'), (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Търсене на клиенти
router.get('/search', checkPermission('clients', 'read'), (req, res) => {
    const { q } = req.query;
    db.all(
        'SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ?',
        [`%${q}%`, `%${q}%`],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

// Неплатени фактури по клиент (групирано по client_name)
// Returns: [{ client_name, unpaid_count }]
router.get('/unpaid-invoices', checkPermission('clients', 'read'), (req, res) => {
    db.all(
        `
          SELECT
            o.client_name AS client_name,
            COUNT(*) AS unpaid_count
          FROM orders o
          JOIN order_documents od ON od.order_id = o.id
          WHERE o.status = 'completed'
            AND COALESCE(od.is_paid, 0) = 0
          GROUP BY o.client_name
          ORDER BY unpaid_count DESC
        `,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            return res.json(rows || []);
        }
    );
});

// Статистика за фактури по клиент (групирано по client_name)
// Returns: [{ client_name, not_invoiced, invoiced_unpaid, paid }]
router.get('/invoice-stats', checkPermission('clients', 'read'), (req, res) => {
    db.all(
        `
          SELECT
            o.client_name AS client_name,
            SUM(CASE WHEN od.order_id IS NULL THEN 1 ELSE 0 END) AS not_invoiced,
            SUM(CASE WHEN od.order_id IS NOT NULL AND COALESCE(od.is_paid, 0) = 0 THEN 1 ELSE 0 END) AS invoiced_unpaid,
            SUM(CASE WHEN od.order_id IS NOT NULL AND COALESCE(od.is_paid, 0) = 1 THEN 1 ELSE 0 END) AS paid
          FROM orders o
          LEFT JOIN order_documents od ON od.order_id = o.id
          WHERE o.status = 'completed'
          GROUP BY o.client_name
        `,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            return res.json(rows || []);
        }
    );
});

// Създаване на клиент
router.post('/', checkPermission('clients', 'write'), (req, res) => {
    const { name, email, address, city, eik, vat_number, mol, phone, vehicles } = req.body;

    db.run(
        'INSERT INTO clients (name, email, address, city, eik, vat_number, mol, phone, vehicles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, email || null, address, city || null, eik, vat_number || null, mol || null, phone, vehicles || null],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get('SELECT * FROM clients WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Вземане на клиент по ID
router.get('/:id', checkPermission('clients', 'read'), (req, res) => {
    db.get('SELECT * FROM clients WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            return res.status(404).json({ error: 'Клиентът не е намерен.' });
        }
        res.json(row);
    });
});

// Редакция на клиент
router.put('/:id', checkPermission('clients', 'write'), (req, res) => {
    const { name, email, address, city, eik, vat_number, mol, phone } = req.body;
    db.run(
        `UPDATE clients SET
            name = COALESCE(?, name),
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            eik = COALESCE(?, eik),
            vat_number = COALESCE(?, vat_number),
            mol = COALESCE(?, mol),
            phone = COALESCE(?, phone)
         WHERE id = ?`,
        [
            name ?? null,
            email ?? null,
            address ?? null,
            city ?? null,
            eik ?? null,
            vat_number ?? null,
            mol ?? null,
            phone ?? null,
            req.params.id
        ],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Клиентът не е намерен.' });
            }
            db.get('SELECT * FROM clients WHERE id = ?', [req.params.id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Изтриване на клиент
router.delete('/:id', checkPermission('clients', 'delete'), (req, res) => {
    db.run('DELETE FROM clients WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Клиентът е изтрит.' });
    });
});

// Добавяне на автомобил към клиент
router.patch('/:id/add-vehicle', (req, res) => {
    const { vehicle } = req.body;
    const clientId = req.params.id;

    // Първо взимаме текущите автомобили
    db.get('SELECT vehicles FROM clients WHERE id = ?', [clientId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            return res.status(404).json({ error: 'Клиентът не е намерен.' });
        }

        const currentVehicles = row.vehicles || '';
        const newVehicles = currentVehicles ? `${currentVehicles}, ${vehicle}` : vehicle;

        // Обновяваме записа
        db.run('UPDATE clients SET vehicles = ? WHERE id = ?', [newVehicles, clientId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Автомобилът е добавен успешно.' });
        });
    });
});

module.exports = router;
