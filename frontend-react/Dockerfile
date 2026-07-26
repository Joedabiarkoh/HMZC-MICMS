FROM node:20-alpine AS build
WORKDIR /app
# Optional build arg — when set (e.g. by Railway, where frontend and
# backend are two separate services with no shared nginx to proxy
# between them, unlike the local Docker Compose setup), this overrides
# the committed .env.production's relative "/api" with the backend's
# actual absolute URL. .env.production.local takes priority over
# .env.production, and is git-ignored, so local builds are unaffected
# when this arg isn't passed. Same technique render.yaml already used.
ARG VITE_API_BASE_URL
COPY package.json .
RUN npm install
COPY . .
RUN if [ -n "$VITE_API_BASE_URL" ]; then echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > .env.production.local; fi
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Placed under /etc/nginx/templates/ (not copied straight to conf.d/)
# so the base image's own docker-entrypoint.d/20-envsubst-on-templates.sh
# renders ${PORT} at container startup, same mechanism the base image
# already runs on every boot (visible in its own startup logs) — nginx
# itself has no way to read an env var directly in its config, and the
# port to listen on can only be known at runtime: Railway assigns and
# injects PORT per deployment, so it can't be baked in at build time the
# way VITE_API_BASE_URL above is. Defaults to 80 for local Docker
# Compose, which doesn't set PORT and expects nginx on 80 (see
# docker-compose.yml's "3000:80" mapping).
ENV PORT=80
# Restricts envsubst to substituting only $PORT — without this, the
# entrypoint script's default behavior substitutes every actual
# environment variable it finds a "$name" match for anywhere in the
# template. nginx's OWN variables ($host, $request_uri, $upstream_backend
# in nginx.conf) aren't real environment variables so they're in no
# danger today, but pinning this explicitly means a future Railway-
# injected env var can never accidentally collide with and mangle one.
ENV NGINX_ENVSUBST_TEMPLATE_VARS=PORT
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
