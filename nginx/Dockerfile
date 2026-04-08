FROM nginx:1.27-alpine

# Install openssl (for DH param generation and self-signed cert fallback) + bash + curl
RUN apk add --no-cache openssl bash curl

# Pre-generate 2048-bit DH params at build time.
# This takes ~10-30s during `docker compose build` but eliminates the runtime
# cost and avoids weak DHE keys. Referenced in nginx.conf as ssl_dhparam.
RUN openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy cert generation script (validates mkcert certs or falls back to self-signed)
COPY generate-certs.sh /docker-entrypoint.d/10-generate-certs.sh
RUN chmod +x /docker-entrypoint.d/10-generate-certs.sh

# Create certs directory (will be bind-mounted at runtime from ./nginx/certs/)
RUN mkdir -p /etc/nginx/certs

EXPOSE 80 443
