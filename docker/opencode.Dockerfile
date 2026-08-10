# Contenedor de la instancia local de opencode (proveedor de IA).
# La config headless niega todas las tools (bash/escritura) y las preguntas al
# usuario, de modo que solo responde en texto sin tocar el sistema de archivos.
FROM node:24-slim

RUN npm install -g opencode-ai
COPY opencode-server.json /root/.config/opencode/opencode.json
ENV OPENCODE_DISABLE_AUTOUPDATE=1 \
    OPENCODE_DISABLE_LSP_DOWNLOAD=1 \
    OPENCODE_DISABLE_PRUNE=1

# Directorio de trabajo que usa el backend al crear sesiones (opencode y
# backend viven en contenedores separados, así que debe existir aquí).
RUN mkdir -p /tmp/opencode-workspace

EXPOSE 4096

CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
