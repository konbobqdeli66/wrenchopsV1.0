# Nginx настройка (подробно) за droplet + viatransport-service.xyz

Този документ е само за стъпката **Nginx** (копиране на конфиг, symlink, тест и reload).

Изискване: вече си влязъл по SSH в droplet-а и проектът е в `/var/www/wrenchops`.

---

## 1) Копирай готовия Nginx конфиг от проекта към Nginx

Команда (копи/пейст, после Enter):

```
sudo cp /var/www/wrenchops/deploy/nginx/wrenchops.conf /etc/nginx/sites-available/wrenchops.conf
```

## 2) Активирай сайта (symlink в sites-enabled)

```
sudo ln -sf /etc/nginx/sites-available/wrenchops.conf /etc/nginx/sites-enabled/wrenchops.conf
```

## 3) (По желание) махни default сайта

```
sudo rm -f /etc/nginx/sites-enabled/default
```

## 4) Провери конфигурацията (трябва да пише "syntax is ok")

```
sudo nginx -t
```

## 5) Reload Nginx (без да убива връзките)

```
sudo systemctl reload nginx
```

## 6) Ако трябва да редактираш домейна (server_name)

Отвори файла с nano:

```
sudo nano /etc/nginx/sites-available/wrenchops.conf
```

В nano (клавишни комбинации):
- Търсене: Ctrl+W
- Запази: Ctrl+O, после Enter
- Изход: Ctrl+X

След редакция, винаги:

```
sudo nginx -t
sudo systemctl reload nginx
```

---

## Бързи проверки

Провери дали Nginx работи:

```
sudo systemctl status nginx --no-pager
```

Гледай логове:

```
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

