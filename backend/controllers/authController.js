const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const SECRET = "super_secret_key"; // по-късно можем да го преместим в .env

// REGISTER USER
exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Проверка дали имейл вече съществува
    const checkUser = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "Потребителят вече съществува!" });
    }

    // Криптиране на парола
    const hashedPassword = await bcrypt.hash(password, 10);

    // Запис в таблицата users
    await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, hashedPassword]
    );

    res.json({ message: "Регистрация успешна!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Грешка в сървъра" });
  }
};

// LOGIN USER
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Проверка дали потребителят съществува
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Грешен имейл или парола!" });
    }

    const user = result.rows[0];

    // Проверка на парола
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ message: "Грешен имейл или парола!" });
    }

    // Генериране на токен
    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "24h" });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Грешка в сървъра" });
  }
};
