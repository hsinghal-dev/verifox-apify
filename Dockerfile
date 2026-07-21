# Apify's maintained Node.js actor base image (Node 20).
FROM apify/actor-node:20

# Install production deps first for better layer caching.
COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --omit=dev --no-optional \
    && echo "Installed npm packages:" \
    && (npm ls --omit=dev --all || true)

# Copy the rest of the actor source.
COPY . ./

CMD ["node", "src/main.js"]
