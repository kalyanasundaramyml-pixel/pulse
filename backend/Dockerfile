FROM node:20-alpine AS build
WORKDIR /app

# Trust an optional corporate root CA so npm/apk can fetch over HTTPS when
# built on a machine behind a TLS-inspecting proxy. Drop your org's CA
# cert(s) as .crt files into ./certs before building; no-op if empty.
# Appended straight into the base image's pre-installed bundle *before* the
# apk call below — that call itself needs network access, so under TLS
# inspection it would fail before ca-certificates/update-ca-certificates are
# even available to fix it.
COPY certs/ /tmp/corporate-certs/
RUN for f in /tmp/corporate-certs/*.crt; do \
      [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; \
    done; \
    rm -rf /tmp/corporate-certs
RUN apk add --no-cache ca-certificates openssl
COPY certs/ /usr/local/share/ca-certificates/corporate/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production

COPY certs/ /tmp/corporate-certs/
RUN for f in /tmp/corporate-certs/*.crt; do \
      [ -f "$f" ] && cat "$f" >> /etc/ssl/certs/ca-certificates.crt; \
    done; \
    rm -rf /tmp/corporate-certs
RUN apk add --no-cache ca-certificates openssl
COPY certs/ /usr/local/share/ca-certificates/corporate/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
RUN npx prisma generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
