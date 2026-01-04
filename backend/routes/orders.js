const express = require('express');
const router = express.Router();
const db = require('../db');
const puppeteer = require('puppeteer');
const { checkPermission } = require('../middleware/permissions');

// Reuse a single Chromium instance to avoid slow startup on every email.
let sharedPdfBrowser = null;
const getPdfBrowser = async () => {
    if (sharedPdfBrowser) return sharedPdfBrowser;
    sharedPdfBrowser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return sharedPdfBrowser;
};

const closePdfBrowser = async () => {
    if (!sharedPdfBrowser) return;
    try {
        await sharedPdfBrowser.close();
    } catch {
        // ignore
    } finally {
        sharedPdfBrowser = null;
    }
};

process.on('exit', () => {
    // Best-effort close
    void closePdfBrowser();
});

const padLeft = (num, len) => String(num ?? '').padStart(len, '0');

// Всички активни поръчки
router.get('/', checkPermission('orders', 'read'), (req, res) => {
    db.all(
        `
          SELECT
            o.*,
            COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) AS total_hours
          FROM orders o
          LEFT JOIN order_worktimes ow ON ow.order_id = o.id
          LEFT JOIN worktimes w ON w.id = ow.worktime_id
          WHERE o.status = 'active'
          GROUP BY o.id
          ORDER BY o.created_at DESC
        `,
        [],
        (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
        }
    );
});

// Всички приключени поръчки (за фактуриране)
router.get('/completed', checkPermission('orders', 'read'), (req, res) => {
    // Also return computed totals so the UI can show the value per order without extra calls.
    // Uses the CURRENT company_settings hourly_rate/vat_rate and applies multipliers if invoiced.
    db.all(
        `
          SELECT
            o.*,
            COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) AS total_hours,
            (COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) * COALESCE((SELECT hourly_rate FROM company_settings WHERE id = 1), 100) * COALESCE(od.mult_out_of_hours, 1) * COALESCE(od.mult_holiday, 1) * COALESCE(od.mult_out_of_service, 1)) AS tax_base_bgn,
            ((COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) * COALESCE((SELECT hourly_rate FROM company_settings WHERE id = 1), 100) * COALESCE(od.mult_out_of_hours, 1) * COALESCE(od.mult_holiday, 1) * COALESCE(od.mult_out_of_service, 1)) * (COALESCE((SELECT vat_rate FROM company_settings WHERE id = 1), 20) / 100.0)) AS vat_amount_bgn,
            ((COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) * COALESCE((SELECT hourly_rate FROM company_settings WHERE id = 1), 100) * COALESCE(od.mult_out_of_hours, 1) * COALESCE(od.mult_holiday, 1) * COALESCE(od.mult_out_of_service, 1)) * (1.0 + (COALESCE((SELECT vat_rate FROM company_settings WHERE id = 1), 20) / 100.0))) AS total_amount_bgn
          FROM orders o
          LEFT JOIN order_worktimes ow ON ow.order_id = o.id
          LEFT JOIN worktimes w ON w.id = ow.worktime_id
          LEFT JOIN order_documents od ON od.order_id = o.id
          WHERE o.status = 'completed'
          GROUP BY o.id
          ORDER BY o.completed_at DESC, o.created_at DESC
        `,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

// All reserved document numbers (for UI indicators)
router.get('/documents', checkPermission('orders', 'read'), (req, res) => {
    db.all('SELECT * FROM order_documents ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Delete invoice/protocol document numbers for an order (ADMIN / users with orders:delete)
// NOTE: This does NOT rewind company_settings invoice counters (numbers are not reused).
router.delete('/:id/documents', checkPermission('orders', 'delete'), (req, res) => {
    const orderId = req.params.id;

    db.run('DELETE FROM order_documents WHERE order_id = ?', [orderId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Няма фактура за тази поръчка.' });
        }
        return res.json({ success: true });
    });
});

// Търсене на поръчки по рег. номер или име на клиент
router.get('/search', checkPermission('orders', 'read'), (req, res) => {
    const { q } = req.query;
    db.all(
        `
          SELECT
            o.*,
            COALESCE(SUM(COALESCE(w.hours, 0) * COALESCE(ow.quantity, 0)), 0) AS total_hours
          FROM orders o
          LEFT JOIN order_worktimes ow ON ow.order_id = o.id
          LEFT JOIN worktimes w ON w.id = ow.worktime_id
          WHERE o.status = 'active'
            AND (o.reg_number LIKE ? OR o.client_name LIKE ?)
          GROUP BY o.id
          ORDER BY o.created_at DESC
        `,
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

// Създаване на поръчка
router.post('/', checkPermission('orders', 'write'), (req, res) => {
    const { client_id, client_name, reg_number, complaint } = req.body;

    const cleanClientName = String(client_name || '').trim();
    const cleanRegNumber = String(reg_number || '').trim();
    const cleanComplaint = String(complaint ?? '').trim() || 'Няма добавено оплакване';

    db.run(
        'INSERT INTO orders (client_id, client_name, reg_number, complaint) VALUES (?, ?, ?, ?)',
        [client_id || null, cleanClientName, cleanRegNumber, cleanComplaint],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Редакция на поръчка (преди фактуриране)
router.put('/:id', checkPermission('orders', 'write'), (req, res) => {
    const { id } = req.params;
    const { client_name, reg_number, complaint, status } = req.body;

    db.run(
        'UPDATE orders SET client_name = COALESCE(?, client_name), reg_number = COALESCE(?, reg_number), complaint = COALESCE(?, complaint), status = COALESCE(?, status) WHERE id = ?',
        [client_name ?? null, reg_number ?? null, complaint ?? null, status ?? null, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Поръчката не е намерена.' });
                return;
            }
            db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Приключване (затваряне) на поръчка
// Mark an order as completed so it no longer appears in the active orders list.
router.put('/:id/complete', checkPermission('orders', 'write'), (req, res) => {
    const { id } = req.params;

    db.run(
        "UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
        [id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Поръчката не е намерена.' });
                return;
            }
            db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Reserve (and persist) Protocol/Invoice numbers for an order.
// Uses company_settings.invoice_last_number / protocol_last_number counters.
router.post('/:id/documents/reserve', checkPermission('orders', 'write'), (req, res) => {
    const orderId = req.params.id;
    const multFlags = req.body?.multipliers || {};

    db.get('SELECT * FROM order_documents WHERE order_id = ?', [orderId], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (existing) {
            return res.json(existing);
        }

        db.serialize(() => {
            db.run('BEGIN IMMEDIATE TRANSACTION');

            // Ensure company_settings row exists
            db.run('INSERT OR IGNORE INTO company_settings (id) VALUES (1)');

            db.get(
                `
                  SELECT
                    invoice_prefix,
                    invoice_pad_length,
                    invoice_last_number,
                    protocol_pad_length,
                    protocol_last_number,
                    price_multiplier_out_of_hours,
                    price_multiplier_holiday,
                    price_multiplier_out_of_service
                  FROM company_settings
                  WHERE id = 1
                `,
                [],
                (err, settings) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    const invoicePrefix = settings?.invoice_prefix ?? '09';
                    const invoicePadLength = Math.max(1, parseInt(settings?.invoice_pad_length, 10) || 8);
                    const lastInvoice = parseInt(settings?.invoice_last_number, 10) || 0;

                    const protocolPadLength = Math.max(1, parseInt(settings?.protocol_pad_length, 10) || 10);
                    const lastProtocol = parseInt(settings?.protocol_last_number, 10) || 0;

                    const mOutOfHours = Number(settings?.price_multiplier_out_of_hours) || 1;
                    const mHoliday = Number(settings?.price_multiplier_holiday) || 1;
                    const mOutOfService = Number(settings?.price_multiplier_out_of_service) || 1;

                    const mult_out_of_hours = multFlags?.out_of_hours ? mOutOfHours : 1;
                    const mult_holiday = multFlags?.holiday ? mHoliday : 1;
                    const mult_out_of_service = multFlags?.out_of_service ? mOutOfService : 1;

                    const nextInvoice = lastInvoice + 1;
                    const nextProtocol = lastProtocol + 1;

                    const protocolNo = padLeft(nextProtocol, protocolPadLength);
                    const invoiceNo = `${invoicePrefix}${padLeft(nextInvoice, invoicePadLength)}`;

                    db.run(
                        'UPDATE company_settings SET invoice_last_number = ?, protocol_last_number = ? WHERE id = 1',
                        [nextInvoice, nextProtocol],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: err.message });
                            }

                            db.run(
                                `
                                  INSERT INTO order_documents (
                                    order_id,
                                    protocol_no,
                                    invoice_no,
                                    mult_out_of_hours,
                                    mult_holiday,
                                    mult_out_of_service
                                  )
                                  VALUES (?, ?, ?, ?, ?, ?)
                                `,
                                [
                                  orderId,
                                  protocolNo,
                                  invoiceNo,
                                  mult_out_of_hours,
                                  mult_holiday,
                                  mult_out_of_service,
                                ],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: err.message });
                                    }

                                    db.get(
                                        'SELECT * FROM order_documents WHERE order_id = ?',
                                        [orderId],
                                        (err, row) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: err.message });
                                            }
                                            db.run('COMMIT');
                                            return res.json(row);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Mark an invoiced order as PAID.
// This updates order_documents only (order remains status=completed).
router.put('/:id/documents/paid', checkPermission('orders', 'write'), (req, res) => {
    const orderId = req.params.id;

    db.get('SELECT * FROM order_documents WHERE order_id = ?', [orderId], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!existing) {
            return res.status(404).json({ error: 'Няма фактура за тази поръчка (не е фактурирана).' });
        }

        db.run(
            "UPDATE order_documents SET is_paid = 1, paid_at = COALESCE(paid_at, datetime('now')) WHERE order_id = ?",
            [orderId],
            function (updErr) {
                if (updErr) {
                    return res.status(500).json({ error: updErr.message });
                }
                db.get('SELECT * FROM order_documents WHERE order_id = ?', [orderId], (getErr, row) => {
                    if (getErr) {
                        return res.status(500).json({ error: getErr.message });
                    }
                    return res.json(row);
                });
            }
        );
    });
});

// Send invoice by email as PDF attachment.
// Body: { to: string, recipient?: { name, eik, vat_number, city, address, mol } }
  router.post('/:id/documents/email-invoice', checkPermission('orders', 'write'), async (req, res) => {
    try {
        const orderId = req.params.id;
        const { to, recipient } = req.body || {};

        if (!to) {
            return res.status(400).json({ error: 'Липсва имейл адрес (to).' });
        }

        const emailService = req.app.get('emailService');
        if (!emailService?.sendInvoiceEmail) {
            return res.status(500).json({ error: 'Email service is not configured.' });
        }

        // Temporary workaround: when EMAIL_MODE=manual, never attempt SMTP.
        // The user should download the PDFs and send them manually.
        if (emailService?.isManual) {
            return res.json({
                success: true,
                email_skipped: true,
                message: 'Email sending is disabled (EMAIL_MODE=manual). Download the PDFs and send them manually.',
            });
        }

        const dbGet = (sql, params) =>
            new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

        const dbAll = (sql, params) =>
            new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });

        const escapeHtml = (unsafe) =>
            String(unsafe ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');

        const safeFilePart = (s) =>
            String(s || '')
                .trim()
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                .replace(/\s+/g, ' ');

        const toBgDate = (sqliteDt) => {
            // 'YYYY-MM-DD HH:MM:SS' -> 'DD.MM.YYYY'
            const d = String(sqliteDt || '').slice(0, 10);
            const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return '—';
            return `${m[3]}.${m[2]}.${m[1]}`;
        };

        const order = await dbGet('SELECT client_name, reg_number, completed_at, created_at FROM orders WHERE id = ?', [orderId]);
        const vehicleRow = await dbGet(
            'SELECT vehicle_type FROM vehicles WHERE UPPER(reg_number) = UPPER(?) LIMIT 1',
            [order?.reg_number || '']
        );
        const assetLabel = vehicleRow?.vehicle_type === 'trailer' ? 'ремарке' : 'влекач';
        const docs = await dbGet(
            'SELECT protocol_no, invoice_no, mult_out_of_hours, mult_holiday, mult_out_of_service FROM order_documents WHERE order_id = ?',
            [orderId]
        );
        const company =
            (await dbGet(
                `
                  SELECT
                    company_name, eik, vat_number, city, address, mol,
                    phone, contact_email,
                    bank_name, bic, iban,
                    logo_data_url,
                    payment_method,
                    hourly_rate,
                    vat_rate,
                    eur_rate,
                    invoice_prepared_by_name
                  FROM company_settings
                  WHERE id = 1
                `,
                []
            )) || {};

        // Per-account "Съставил" name (user_preferences) has priority over global company settings.
        const userPrefs = await dbGet(
            'SELECT invoice_prepared_by_name FROM user_preferences WHERE user_id = ?',
            [req.user?.id]
        ).catch(() => null);

        const preparedByName =
            String(userPrefs?.invoice_prepared_by_name || '').trim() ||
            String(company?.invoice_prepared_by_name || '').trim() ||
            String(req.user?.full_name || req.user?.nickname || '').trim();

        const worktimeRows = await dbAll(
            `
              SELECT
                w.title as worktime_title,
                w.hours,
                ow.quantity,
                ow.notes
              FROM order_worktimes ow
              JOIN worktimes w ON ow.worktime_id = w.id
              WHERE ow.order_id = ?
              ORDER BY ow.created_at ASC
            `,
            [orderId]
        );

        const totalHours = worktimeRows.reduce(
            (sum, r) => sum + (Number(r.hours) || 0) * (Number(r.quantity) || 0),
            0
        );

        const hourlyRate = Number(company.hourly_rate) || 100;
        const vatRate = Number(company.vat_rate) || 20;
        const eurRate = Number(company.eur_rate) || 1.95583;
        const toEur = (bgn) => (Number(bgn) || 0) / eurRate;
        const fmt2 = (n) => (Number(n) || 0).toFixed(2);
        const fmtBgnEur = (bgn) => `${fmt2(bgn)} BGN / ${fmt2(toEur(bgn))} EUR`;
        const multiplier =
            (Number(docs?.mult_out_of_hours) || 1) *
            (Number(docs?.mult_holiday) || 1) *
            (Number(docs?.mult_out_of_service) || 1);

        const taxBase = totalHours * hourlyRate * multiplier;
        const vatAmount = taxBase * (vatRate / 100);
        const totalAmount = taxBase + vatAmount;

        const resolvedRecipient = {
            name: recipient?.name || order?.client_name || '',
            eik: recipient?.eik || '',
            vat_number: recipient?.vat_number || '',
            city: recipient?.city || '',
            address: recipient?.address || '',
            mol: recipient?.mol || '',
        };

        const issueDateSql = order?.completed_at || order?.created_at || '';
        const issueDateBg = toBgDate(issueDateSql);

        const regNumber = safeFilePart(order?.reg_number || `order-${orderId}`);
        // Example requested: Фактура(рег.номер)/(дата) -> use '_' instead of '/' for a valid filename.
        const filename = `Фактура(${regNumber})_${issueDateBg}.pdf`;
        const subject = `Фактура ${docs?.invoice_no ? `№${docs.invoice_no} ` : ''}(${regNumber}) ${issueDateBg}`.trim();

        const logoHtml = company.logo_data_url
            ? `<img src="${escapeHtml(company.logo_data_url)}" style="max-width:110px; max-height:110px; object-fit:contain;" />`
            : '';

        const invoiceRowHtml = `
          <tr>
            <td style="text-align:center">1</td>
            <td>Ремонт на превозно средство с регистрационен номер ${escapeHtml(order?.reg_number || '')} съгласно работна карта: ${escapeHtml(docs?.protocol_no || '')}</td>
            <td>${escapeHtml(order?.reg_number || '')}</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">${taxBase.toFixed(2)}</td>
            <td style="text-align:right">${vatRate.toFixed(2)}%</td>
            <td style="text-align:right">${taxBase.toFixed(2)}</td>
          </tr>
        `;

        const invoiceHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Фактура №${escapeHtml(docs?.invoice_no || '')}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #111; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { margin: 0; font-size: 20px; font-weight: 900; text-align: center; }
      .meta { font-size: 12.5px; color: #333; margin: 4px 0; }
      .badge { display:inline-block; border:2px solid #111; padding:2px 10px; font-weight: 900; letter-spacing: 1px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 10px; }
      .box { border: 1px solid #111; padding: 8px 10px; font-size: 12.5px; }
      table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 12px; }
      th, td { border: 1px solid #333; padding: 6px 8px; }
      th { background: #f5f5f5; text-align: left; }
      .right { text-align: right; }
      .muted { color: #555; }
    </style>
  </head>
  <body>
    ${logoHtml ? `<div style="display:flex; justify-content:flex-end;">${logoHtml}</div>` : ''}
    <h1>Фактура</h1>
    <div style="text-align:center; margin-top: 4px;">
      <div class="meta"><strong>No:</strong> ${escapeHtml(docs?.invoice_no || '')}</div>
      <div class="meta"><span class="badge">ОРИГИНАЛ</span></div>
    </div>

    <div class="meta" style="margin-top: 8px; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 6px 0; display:flex; gap: 16px; flex-wrap: wrap;">
      <div><span>Дата на издаване:</span> <strong>${escapeHtml(issueDateBg)}</strong></div>
      <div><span>Дата на дан. събитие:</span> <strong>${escapeHtml(issueDateBg)}</strong></div>
      <div style="margin-left:auto;"><span>Място на сделката:</span> <strong>${escapeHtml(company.city || '')}</strong></div>
    </div>

    <div class="grid2">
      <div>
        <div class="meta" style="font-weight:900;">Получател:</div>
        <div class="box">
          <div><span>Име на фирма:</span> <strong>${escapeHtml(resolvedRecipient.name)}</strong></div>
          <div><span>ЕИК:</span> <strong>${escapeHtml(resolvedRecipient.eik)}</strong></div>
          <div><span>ДДС No:</span> <strong>${escapeHtml(resolvedRecipient.vat_number)}</strong></div>
          <div><span>Град:</span> <strong>${escapeHtml(resolvedRecipient.city)}</strong></div>
          <div><span>Адрес:</span> <strong>${escapeHtml(resolvedRecipient.address)}</strong></div>
          <div><span>МОЛ:</span> <strong>${escapeHtml(resolvedRecipient.mol)}</strong></div>
        </div>
      </div>
      <div>
        <div class="meta" style="font-weight:900;">Доставчик:</div>
        <div class="box">
          <div><span>Име на фирма:</span> <strong>${escapeHtml(company.company_name || '')}</strong></div>
          <div><span>ЕИК:</span> <strong>${escapeHtml(company.eik || '')}</strong></div>
          <div><span>ДДС No:</span> <strong>${escapeHtml(company.vat_number || '')}</strong></div>
          <div><span>Град:</span> <strong>${escapeHtml(company.city || '')}</strong></div>
          <div><span>Адрес:</span> <strong>${escapeHtml(company.address || '')}</strong></div>
          <div><span>МОЛ:</span> <strong>${escapeHtml(company.mol || '')}</strong></div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:10mm; text-align:center;">No</th>
          <th>Име на стоката/услугата</th>
          <th style="width: 25mm;">Марка</th>
          <th style="width: 14mm;" class="right">К-во</th>
          <th style="width: 22mm;" class="right">Ед. цена</th>
          <th style="width: 18mm;" class="right">ДДС (%)</th>
          <th style="width: 26mm;" class="right">Стойност</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRowHtml}
        <tr>
          <td colspan="6" class="right" style="font-weight:700;">Данъчна основа (${vatRate.toFixed(2)} %):</td>
          <td class="right" style="font-weight:700;">${fmtBgnEur(taxBase)}</td>
        </tr>
        <tr>
          <td colspan="6" class="right" style="font-weight:700;">Начислен ДДС (${vatRate.toFixed(2)} %):</td>
          <td class="right" style="font-weight:700;">${fmtBgnEur(vatAmount)}</td>
        </tr>
        <tr>
          <td colspan="6" class="right" style="font-weight:900;">Сума за плащане:</td>
          <td class="right" style="font-weight:900;">${fmtBgnEur(totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="grid2" style="margin-top: 14px;">
      <div>
        <div class="meta"><span>Начин на плащане:</span> <strong>${escapeHtml(company.payment_method || 'Банков път')}</strong></div>
        <div class="meta" style="margin-top: 6px;"><span>Банкови реквизити:</span></div>
        <div class="meta"><strong>${escapeHtml(company.bank_name || '')}${company.bic ? `, BIC: ${escapeHtml(company.bic)}` : ''}</strong></div>
        <div class="meta"><strong>${escapeHtml(company.iban || '')}</strong></div>
      </div>
      <div>
        <div class="meta"><span>Основание:</span> <strong>Работна карта №${escapeHtml(String(orderId))}</strong></div>
        <div class="meta"><span class="muted">Протокол №${escapeHtml(docs?.protocol_no || '')}</span></div>
        <div class="meta"><span>Сума в EUR:</span> <strong>${fmt2(toEur(totalAmount))} EUR</strong></div>
      </div>
    </div>

    <div class="meta" style="margin-top: 18px; display:flex; justify-content: flex-end;">
      <div><strong>Съставил:</strong> ${escapeHtml(preparedByName || '—')}</div>
    </div>
  </body>
</html>`;

        const protocolRowsHtml = (worktimeRows || [])
            .map((r, idx) => {
                const h = Number(r.hours) || 0;
                const q = Number(r.quantity) || 0;
                const total = h * q;
                const notes = r.notes ? escapeHtml(r.notes) : '';
                return `
                  <tr>
                    <td style="text-align:center">${idx + 1}</td>
                    <td>${escapeHtml(r.worktime_title || '')}</td>
                    <td style="white-space: pre-wrap;">${notes}</td>
                    <td style="text-align:right">${h.toFixed(2).replace(/\.00$/, '')}</td>
                    <td style="text-align:right">${q}</td>
                    <td style="text-align:right">${total.toFixed(2).replace(/\.00$/, '')}</td>
                  </tr>
                `;
            })
            .join('');

        const protocolHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Протокол №${escapeHtml(docs?.protocol_no || '')}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #111; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1 { margin: 0; font-size: 20px; font-weight: 900; }
      .meta { font-size: 12.5px; color: #333; margin: 4px 0; }
      .badge { display:inline-block; border:2px solid #111; padding:2px 10px; font-weight: 900; letter-spacing: 1px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 10px; }
      .box { border: 1px solid #111; padding: 8px 10px; font-size: 12.5px; }
      table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 12px; }
      th, td { border: 1px solid #333; padding: 6px 8px; }
      th { background: #f5f5f5; text-align: left; }
      .right { text-align: right; }
      .muted { color: #555; }
    </style>
  </head>
  <body>
    <div style="display:flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
      <div>
        <h1>Протокол</h1>
        <div class="meta"><strong>No:</strong> ${escapeHtml(docs?.protocol_no || '')}</div>
        <div class="meta"><strong>Към фактура No:</strong> ${escapeHtml(docs?.invoice_no || '')}</div>
        <div class="meta"><span class="badge">ОРИГИНАЛ</span></div>
      </div>
      ${logoHtml ? `<div>${logoHtml}</div>` : ''}
    </div>

    <div class="meta" style="margin-top: 8px; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 6px 0; display:flex; gap: 16px; flex-wrap: wrap;">
      <div><span>Дата на издаване:</span> <strong>${escapeHtml(issueDateBg)}</strong></div>
      <div><span>Дата на дан. събитие:</span> <strong>${escapeHtml(issueDateBg)}</strong></div>
      <div style="margin-left:auto;"><span>Рег. №:</span> <strong>${escapeHtml(order?.reg_number || '')}</strong></div>
    </div>

    <div class="grid2">
      <div>
        <div class="meta" style="font-weight:900;">Получател:</div>
        <div class="box">
          <div><span>Име на фирма:</span> <strong>${escapeHtml(resolvedRecipient.name)}</strong></div>
          <div><span>ЕИК:</span> <strong>${escapeHtml(resolvedRecipient.eik)}</strong></div>
          <div><span>ДДС No:</span> <strong>${escapeHtml(resolvedRecipient.vat_number)}</strong></div>
          <div><span>Град:</span> <strong>${escapeHtml(resolvedRecipient.city)}</strong></div>
          <div><span>Адрес:</span> <strong>${escapeHtml(resolvedRecipient.address)}</strong></div>
          <div><span>МОЛ:</span> <strong>${escapeHtml(resolvedRecipient.mol)}</strong></div>
        </div>
      </div>
      <div>
        <div class="meta" style="font-weight:900;">Доставчик:</div>
        <div class="box">
          <div><span>Име на фирма:</span> <strong>${escapeHtml(company.company_name || '')}</strong></div>
          <div><span>ЕИК:</span> <strong>${escapeHtml(company.eik || '')}</strong></div>
          <div><span>ДДС No:</span> <strong>${escapeHtml(company.vat_number || '')}</strong></div>
          <div><span>Град:</span> <strong>${escapeHtml(company.city || '')}</strong></div>
          <div><span>Адрес:</span> <strong>${escapeHtml(company.address || '')}</strong></div>
          <div><span>МОЛ:</span> <strong>${escapeHtml(company.mol || '')}</strong></div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:10mm; text-align:center;">No</th>
          <th>Име на стоката/услугата</th>
          <th style="width: 55mm;">Бележки</th>
          <th style="width: 18mm;" class="right">Часове</th>
          <th style="width: 16mm;" class="right">К-во</th>
          <th style="width: 22mm;" class="right">Общо (ч.)</th>
        </tr>
      </thead>
      <tbody>
        ${protocolRowsHtml || '<tr><td colspan="6" class="muted">Няма добавени нормовремена</td></tr>'}
        <tr>
          <td colspan="5" class="right" style="font-weight:900;">Общо часове:</td>
          <td class="right" style="font-weight:900;">${totalHours.toFixed(2).replace(/\.00$/, '')}</td>
        </tr>
      </tbody>
    </table>

    <div class="meta" style="margin-top: 10px; border-top: 2px solid #111; padding-top: 8px; display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
      <div><span>Данъчна основа:</span> <strong>${fmtBgnEur(taxBase)}</strong></div>
      <div><span>ДДС (${vatRate.toFixed(2)}%):</span> <strong>${fmtBgnEur(vatAmount)}</strong></div>
      <div><span>За плащане:</span> <strong>${fmtBgnEur(totalAmount)}</strong></div>
    </div>

    <div class="meta" style="margin-top: 18px; display:flex; justify-content: flex-end;">
      <div><strong>Съставил:</strong> ${escapeHtml(preparedByName || '—')}</div>
    </div>
  </body>
</html>`;

        // Render both documents to PDF using a shared headless Chromium instance
        const browser = await getPdfBrowser();
        const invoicePage = await browser.newPage();
        const protocolPage = await browser.newPage();
        try {
            await invoicePage.setContent(invoiceHtml, { waitUntil: 'domcontentloaded' });
            const invoicePdf = await invoicePage.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
            });

            await protocolPage.setContent(protocolHtml, { waitUntil: 'domcontentloaded' });
            const protocolPdf = await protocolPage.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
            });

            const protocolFilename = `Протокол(${regNumber})_${issueDateBg}.pdf`;

            const ok = await emailService.sendInvoiceEmail({
                to,
                subject,
                assetLabel,
                regNumber: order?.reg_number || '',
                senderName: req.user?.full_name || req.user?.nickname || '',
                company,
                attachments: [
                    { filename, content: invoicePdf, contentType: 'application/pdf' },
                    { filename: protocolFilename, content: protocolPdf, contentType: 'application/pdf' },
                ],
            });
            if (!ok) {
                return res.status(500).json({ error: 'Грешка при изпращане на имейла.' });
            }
        } finally {
            try { await invoicePage.close(); } catch {}
            try { await protocolPage.close(); } catch {}
        }

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Server error' });
    }
});

// Изтриване на поръчка
router.delete('/:id', checkPermission('orders', 'delete'), (req, res) => {
    db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Поръчката е изтрита.' });
    });
});

// Добавяне на нормовреме към поръчка
router.post('/:orderId/worktimes', checkPermission('orders', 'write'), (req, res) => {
    const { orderId } = req.params;
    const { worktime_id, quantity, notes } = req.body;

    if (!worktime_id) {
        return res.status(400).json({ error: 'worktime_id е задължително поле' });
    }

    const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
    const cleanNotes = String(notes || '').trim();

    // If the user adds the same worktime again WITHOUT notes, increment quantity
    // instead of creating a duplicate row. If notes are provided, keep a separate row.
    if (!cleanNotes) {
        db.get(
            `
                SELECT id, quantity
                FROM order_worktimes
                WHERE order_id = ? AND worktime_id = ? AND TRIM(COALESCE(notes, '')) = ''
                ORDER BY created_at DESC
                LIMIT 1
            `,
            [orderId, worktime_id],
            (findErr, existing) => {
                if (findErr) {
                    return res.status(500).json({ error: findErr.message });
                }

                if (existing?.id) {
                    const newQty = (parseInt(existing.quantity, 10) || 0) + qtyToAdd;
                    db.run(
                        'UPDATE order_worktimes SET quantity = ? WHERE id = ? AND order_id = ?',
                        [newQty, existing.id, orderId],
                        function (updErr) {
                            if (updErr) {
                                return res.status(500).json({ error: updErr.message });
                            }
                            db.get(
                                `
                                    SELECT ow.*, w.title as worktime_title, w.hours, w.component_type
                                    FROM order_worktimes ow
                                    JOIN worktimes w ON ow.worktime_id = w.id
                                    WHERE ow.id = ?
                                `,
                                [existing.id],
                                (getErr, row) => {
                                    if (getErr) {
                                        return res.status(500).json({ error: getErr.message });
                                    }
                                    return res.json(row);
                                }
                            );
                        }
                    );
                    return;
                }

                // No existing "no-notes" row, insert a new one.
                db.run(
                    'INSERT INTO order_worktimes (order_id, worktime_id, quantity, notes) VALUES (?, ?, ?, ?)',
                    [orderId, worktime_id, qtyToAdd, ''],
                    function (insErr) {
                        if (insErr) {
                            return res.status(500).json({ error: insErr.message });
                        }
                        db.get(
                            `
                                SELECT ow.*, w.title as worktime_title, w.hours, w.component_type
                                FROM order_worktimes ow
                                JOIN worktimes w ON ow.worktime_id = w.id
                                WHERE ow.id = ?
                            `,
                            [this.lastID],
                            (getErr, row) => {
                                if (getErr) {
                                    return res.status(500).json({ error: getErr.message });
                                }
                                return res.json(row);
                            }
                        );
                    }
                );
            }
        );
        return;
    }

    // Notes provided -> always insert as a separate row.
    db.run(
        'INSERT INTO order_worktimes (order_id, worktime_id, quantity, notes) VALUES (?, ?, ?, ?)',
        [orderId, worktime_id, qtyToAdd, cleanNotes],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get(`
                SELECT ow.*, w.title as worktime_title, w.hours, w.component_type
                FROM order_worktimes ow
                JOIN worktimes w ON ow.worktime_id = w.id
                WHERE ow.id = ?
            `, [this.lastID], (getErr, row) => {
                if (getErr) {
                    res.status(500).json({ error: getErr.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Вземане на нормовремената за поръчка
router.get('/:orderId/worktimes', checkPermission('orders', 'read'), (req, res) => {
    const { orderId } = req.params;

    db.all(`
        SELECT ow.*, w.title as worktime_title, w.hours, w.component_type
        FROM order_worktimes ow
        JOIN worktimes w ON ow.worktime_id = w.id
        WHERE ow.order_id = ?
        ORDER BY ow.created_at DESC
    `, [orderId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Обновяване на бележки за нормовреме в поръчка
router.put('/:orderId/worktimes/:worktimeId', checkPermission('orders', 'write'), (req, res) => {
    const { orderId, worktimeId } = req.params;
    const { notes, quantity } = req.body;

    const qty = quantity === undefined || quantity === null ? null : Math.max(1, parseInt(quantity, 10) || 1);

    db.run(
        'UPDATE order_worktimes SET notes = COALESCE(?, notes), quantity = COALESCE(?, quantity) WHERE order_id = ? AND id = ?',
        [notes === undefined ? null : (notes || ''), qty, orderId, worktimeId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Нормовремето не е намерено в тази поръчка.' });
                return;
            }
            db.get(`
                SELECT ow.*, w.title as worktime_title, w.hours, w.component_type
                FROM order_worktimes ow
                JOIN worktimes w ON ow.worktime_id = w.id
                WHERE ow.id = ? AND ow.order_id = ?
            `, [worktimeId, orderId], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Изтриване на нормовреме от поръчка
router.delete('/worktimes/:orderWorktimeId', checkPermission('orders', 'delete'), (req, res) => {
    const { orderWorktimeId } = req.params;

    db.run('DELETE FROM order_worktimes WHERE id = ?', [orderWorktimeId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Нормовремето е премахнато от поръчката.' });
    });
});

module.exports = router;
