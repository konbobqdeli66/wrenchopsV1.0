# Подробен гайд (Windows ➜ DigitalOcean droplet) за viatransport-service.xyz

Този гайд е за твоя droplet IP **207.154.208.13** и домейн **viatransport-service.xyz**.

Цел: 
- backend (Node/Express) да работи на **127.0.0.1:5000** под PM2
- frontend (React build) да се сервира от Nginx
- домейнът да отваря приложението на **https://viatransport-service.xyz**

---

## 0) Какво ще ти трябва

1) DigitalOcean droplet (Ubuntu 22.04/24.04 препоръчително)
2) Достъп до DNS на домейна (където се управляват A записите)
3) На Windows: SSH клиент

---

## 1) DNS (домейн ➜ IP)

В DNS панела на домейна създай/провери:

- A запис:
  - Host/Name: `@`
  - Points to: `207.154.208.13`
- (по желание) A запис за www:
  - Host/Name: `www`
  - Points to: `207.154.208.13`

Срок за пропагация: от няколко минути до няколко часа.

---

## 2) Влизане по SSH от Windows (2 варианта)

### Вариант A (препоръчителен): Windows Terminal / PowerShell

1) Отвори Start меню:
   - Натисни **Win**
2) Напиши `powershell`
   - Натисни **Enter**
3) Свържи се по SSH (копирай командата и я пейстни):
   - Paste в PowerShell: **Ctrl+V**
   - Изпълнение: **Enter**

Команда (пример, ако потребителят е root):

```
ssh root@207.154.208.13
```

Ако те пита:

`Are you sure you want to continue connecting (yes/no/[fingerprint])?`

1) Напиши `yes`
2) Натисни **Enter**

### Вариант B: PuTTY

1) Стартирай PuTTY
2) В `Host Name (or IP address)` напиши `207.154.208.13`
3) Натисни `Open`

При PuTTY paste е с **Right Click** (десен клик) в прозореца.

---

## 3) Ъпдейт на системата (в droplet)

В SSH прозореца изпълни (копи/пейст, после Enter):

```
sudo apt update && sudo apt -y upgrade
```

Ако поиска парола:
- напиши паролата (няма да се вижда)
- натисни **Enter**

---

## 4) Инсталирай Node.js (LTS), Nginx, Git

### 4.1 Git + Nginx

```
sudo apt -y install git nginx
```

### 4.2 Node.js (NodeSource LTS)

```
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt -y install nodejs
```

Провери версии:

```
node -v
npm -v
```

---

## 5) Свали проекта от GitHub в /var/www

```
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/konbobqdeli66/wrenchopsV1.0.git wrenchops
cd /var/www/wrenchops
```

---

## 6) Инсталирай зависимости + build на frontend

### 6.1 Инсталирай и в backend и във frontend

```
npm run install:all
```

### 6.2 Направи production build на React

```
npm run build:frontend
```

Това създава `frontend/build` (Nginx ще го сервира).

---

## 7) Конфигурирай backend environment (JWT_SECRET и др.)

### 7.1 Копирай примерния файл

```
cp backend/.env.example backend/.env
```

Ако искаш **готово за copy/paste** (с попълнени ключове за всичко, но с placeholders), можеш да използваш:

```
cp backend/.env.copyme backend/.env
```

### 7.2 Редактирай backend/.env с nano

Команда:

```
nano backend/.env
```

В nano:
- Навигация: стрелките
- Запази: **Ctrl+O**, после **Enter**
- Изход: **Ctrl+X**

ЗАДЪЛЖИТЕЛНО:
- Смени `JWT_SECRET=...` с дълъг случаен стринг.

---

## 8) PM2 (backend като service)

### 8.1 Инсталирай PM2 глобално

```
sudo npm i -g pm2
```

### 8.2 Стартирай backend през ecosystem файла

```
cd /var/www/wrenchops
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
```

### 8.3 Авто-старт при рестарт (pm2 startup)

```
pm2 startup
```

PM2 ще ти изпише 1 команда, която започва със `sudo ...`.

1) Маркирай/копирай тази команда
2) Пейстни я и натисни **Enter**

Провери статус:

```
pm2 status
pm2 logs --lines 100
```

---

## 9) Nginx конфигурация за домейна

### 9.1 Копирай готовия template към sites-available

```
sudo cp /var/www/wrenchops/deploy/nginx/wrenchops.conf /etc/nginx/sites-available/wrenchops.conf
```

### 9.2 Активирай сайта (symlink)

```
sudo ln -sf /etc/nginx/sites-available/wrenchops.conf /etc/nginx/sites-enabled/wrenchops.conf
```

### 9.3 (по желание) махни default сайта

```
sudo rm -f /etc/nginx/sites-enabled/default
```

### 9.4 Тествай и рестартирай Nginx

```
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10) Отвори firewall (ако е включен UFW)

Провери дали UFW е активен:

```
sudo ufw status
```

Ако е active:

```
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 11) SSL (HTTPS) с Certbot

След като DNS сочи към IP-то:

### 11.1 Инсталирай certbot

```
sudo apt -y install certbot python3-certbot-nginx
```

### 11.2 Издай сертификат

```
sudo certbot --nginx -d viatransport-service.xyz -d www.viatransport-service.xyz
```

По време на certbot:
- Избери опция за redirect към HTTPS (препоръчително)

---

## 12) Финални проверки

### 12.1 Backend health

От droplet:

```
curl -s http://127.0.0.1:5000/ | head
```

### 12.2 Отвори сайта

В браузър:

- https://viatransport-service.xyz

---

## Чести проблеми

1) Домейнът не отваря
- DNS не е пропагирал или A record не сочи към IP.

2) 502 Bad Gateway
- backend не работи или не е на порт 5000.
  - провери: `pm2 status` и `pm2 logs`

3) Certbot не минава
- домейнът не сочи към IP-то или порт 80 е блокиран.

