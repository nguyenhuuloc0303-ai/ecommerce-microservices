FROM mongo:7
COPY init-users.sh /docker-entrypoint-initdb.d/init-users.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-users.sh
