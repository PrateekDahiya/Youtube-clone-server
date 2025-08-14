# Use official Node.js LTS version
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (to cache npm install)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your application
COPY . .

# Expose the port Cloud Run will use
EXPOSE 8080

# Set environment variable for Cloud Run
ENV PORT=8080

# Start the application
CMD npm install && npm start
