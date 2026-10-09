#!/usr/bin/env bash
# Запуск Crownfall (PHP 8 + MariaDB) в песочнице. Можно вызывать повторно.
set -euo pipefail
cd "$(dirname "$0")"

exec 9>/tmp/crownfall-start.lock
flock 9

if ! command -v php >/dev/null || ! command -v mariadb >/dev/null; then
  echo ">> Устанавливаю PHP и MariaDB"
  sudo -n rm -rf /var/lib/apt/lists/* 2>/dev/null || true
  sudo -n apt-get update -qq
  DEBIAN_FRONTEND=noninteractive sudo -n apt-get install -y -qq \
    php-cli php-mysql php-mbstring php-xml php-zip php-curl mariadb-server
fi

echo ">> MariaDB"
sudo -n mkdir -p /run/mysqld
sudo -n chown mysql:mysql /run/mysqld
if ! sudo -n mysql -e "SELECT 1" >/dev/null 2>&1; then
  sudo -n service mariadb start || sudo -n service mysql start
  for _ in $(seq 1 30); do
    sudo -n mysql -e "SELECT 1" >/dev/null 2>&1 && break
    sleep 1
  done
fi

sudo -n mysql -e "CREATE DATABASE IF NOT EXISTS crownfall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'crown'@'localhost' IDENTIFIED BY 'crown';
CREATE USER IF NOT EXISTS 'crown'@'127.0.0.1' IDENTIFIED BY 'crown';
GRANT ALL ON crownfall.* TO 'crown'@'localhost';
GRANT ALL ON crownfall.* TO 'crown'@'127.0.0.1';
FLUSH PRIVILEGES;"

echo ">> PHP :8080"
mkdir -p uploads data
if ! curl -sf -m 2 -o /dev/null http://127.0.0.1:8080/; then
  if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp >/dev/null 2>&1 || true
  fi
  # 9>&- — иначе php наследует flock и следующий запуск зависает навсегда.
  setsid nohup php -S 0.0.0.0:8080 -t "$PWD" router.php > /tmp/php-server.log 2>&1 < /dev/null 9>&- &
  for _ in $(seq 1 20); do
    curl -sf -m 1 -o /dev/null http://127.0.0.1:8080/ && break
    sleep 0.3
  done
fi

tables="$(sudo -n mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='crownfall'" 2>/dev/null || echo 0)"
if [ ! -f data/installed.lock ] || [ "${tables:-0}" -lt 10 ]; then
  echo ">> Установка игры"
  rm -f data/installed.lock config.php
  curl -s -m 120 -X POST \
    -d "host=127.0.0.1&port=3306&name=crownfall&user=crown&pass=crown" \
    http://127.0.0.1:8080/install.php | grep -q "Готово!" || {
      echo "Установщик не подтвердил успех" >&2
      exit 1
    }
fi

echo ">> Crownfall готов"
