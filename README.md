# Real-time Chat Application

An advanced real-time chat application built with Node.js, TypeScript, WebSockets, PostgreSQL, and integrated with Cloudflare services for media storage and delivery. This project emphasizes clean architecture and domain-driven design principles.

## Features

*   **Real-time Messaging:** Utilizes WebSockets (`ws` library) for instant message delivery between connected clients.
*   **User Authentication & Authorization:** Secure user login and session management using JSON Web Tokens (JWT). WebSocket connections are also authenticated via JWT.
*   **Direct & Group Chats:** Supports both one-on-one conversations and multi-user group chats.
*   **Media Sharing:** Allows users to share images and potentially other media types, leveraging Cloudflare R2 for storage. *(Note: Specific implementation details for Cloudflare Stream or Images might need further verification in the codebase)*.
*   **File Sharing:** Functionality for sharing various file types.
*   **Message Status:** Indicates whether messages are `sent`, `delivered`, or `read` (Real-time updates via WebSockets for read receipts).
*   **Typing Indicators:** Shows when a user is actively typing in a chat session via WebSocket updates.
*   **Online/Offline Status:** Tracks and broadcasts user presence status (online/offline) to relevant clients in real-time.
*   **Media Storage:** Integrated with Cloudflare R2 for scalable and efficient object storage.
*   **API Documentation:** Provides API documentation via Swagger UI.
*   **Robust Error Handling:** Centralized error handling mechanism.
*   **Structured Logging:** Comprehensive logging using Winston.
*   **Security:** Implements security best practices including Helmet for headers, CORS configuration, rate limiting, and input validation.

## Tech Stack

*   **Backend:** Node.js, Express.js (for routing and middleware), TypeScript.
*   **Database:** PostgreSQL (a powerful open-source relational database).
*   **ORM:** Sequelize (provides an abstraction layer for interacting with the PostgreSQL database).
*   **Real-time Communication:** WebSockets (`ws` library for raw WebSocket implementation).
*   **Authentication:** JSON Web Tokens (JWT) (`jsonwebtoken` library).
*   **Media Storage:** Cloudflare R2 (Object storage service). *(Configuration includes R2 Bucket Name, Public Hostname, Access Key ID, Secret Access Key)*. Potentially Cloudflare Images/Stream based on specific implementation.
*   **Validation:** Joi (for robust request data validation).
*   **Logging:** Winston (a versatile logging library for Node.js, configured for console and file output).
*   **Security:** Helmet (helps secure Express apps by setting various HTTP headers), CORS (enables Cross-Origin Resource Sharing), express-rate-limit (basic rate limiting to prevent abuse).
*   **Containerization:** Docker (Dockerfile provided for building container images).

## Project Structure

The project adheres to principles of Clean Architecture and Domain-Driven Design (DDD) to promote separation of concerns, testability, and maintainability.

```
src/
├── api/                  # API Layer: Handles HTTP requests and WebSocket communication.
│   ├── controllers/      # Request handlers processing input and interacting with core services.
│   ├── middlewares/      # Express middlewares (authentication, error handling, validation).
│   ├── routes/           # Defines API endpoints and links them to controllers.
│   ├── validators/       # Joi schemas for request data validation.
│   └── websocket/        # WebSocket connection handling and message routing (though main logic is in `src/websocket.ts`).
├── config/               # Application configuration, loaded from environment variables (`index.ts`).
├── core/                 # Core business logic orchestration (Use Cases/Application Services - may require more detailed code review).
├── domain/               # Domain Layer: Represents the core business concepts.
│   ├── entities/         # Business objects/entities (e.g., User, Message, Chat).
│   ├── repositories/     # Interfaces defining data access contracts.
│   └── services/         # Domain-specific services containing business logic.
├── infrastructure/       # Infrastructure Layer: Implements external concerns.
│   ├── database/         # Database setup (Sequelize), connection, and migrations management.
│   ├── repositories/     # Concrete implementations of repository interfaces using Sequelize.
│   └── storage/          # Implementations for interacting with external storage (e.g., Cloudflare R2).
├── utils/                # Utility functions (e.g., logger, helper functions).
├── server.ts             # Application entry point: Sets up Express, database, middlewares, WebSocket server, and starts the HTTP server.
└── websocket.ts          # Core WebSocket server logic: Handles connections, authentication, message broadcasting, typing indicators, read receipts, and user status.
```

## Getting Started

### Prerequisites

*   Node.js (v14 or higher recommended)
*   npm (usually comes with Node.js)
*   PostgreSQL Server
*   Cloudflare Account (for R2 object storage - requires Account ID, R2 Bucket details, and API credentials)
*   Docker (Optional, for running in a container)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/deniz1976/Chat-App.git
    cd Chat-App
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory (`Chat-App/.env`) based on the `.env.example` (if provided) or the structure below. Fill in your specific configuration details.

    ```dotenv
    # Server Configuration
    PORT=3000
    NODE_ENV=development # or production

    # Database Configuration (PostgreSQL)
    DB_DIALECT=postgres
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=chat_app
    DB_SSL=false # Set to true if using SSL connection

    # JWT Authentication
    JWT_SECRET=your_strong_jwt_secret_key # Use a long, random, secure string
    JWT_EXPIRES_IN=1d # e.g., 1d, 12h, 60m

    # Cloudflare Configuration
    CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
    CLOUDFLARE_API_TOKEN=your_cloudflare_api_token # General API Token (scope permissions appropriately)
    # CLOUDFLARE_IMAGES_TOKEN=your_cloudflare_images_api_token # If using Cloudflare Images specifically
    CLOUDFLARE_R2_BUCKET_NAME=your_r2_bucket_name
    CLOUDFLARE_R2_PUBLIC_HOSTNAME=your_r2_public_url # e.g., https://pub-yourhash.r2.dev
    CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id
    CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
    ```
    *Ensure your Cloudflare API tokens and R2 credentials have the necessary permissions.*

4.  **Create the database:**
    Ensure your PostgreSQL server is running. Connect using a tool like `psql` or a GUI client and run:
    ```sql
    CREATE DATABASE chat_app;
    ```
    *(Adjust the database name if you changed it in `.env`)*

5.  **Run database migrations:**
    This command sets up the necessary tables in your database based on the Sequelize migration files.
    ```bash
    npm run migration:run
    ```

### Running the Application

*   **Development Mode:**
    Uses `ts-node` and `nodemon` for automatic restarts on file changes.
    ```bash
    npm run dev
    ```
    The server will typically start on `http://localhost:3000` (or the `PORT` specified in `.env`).

*   **Production Mode:**
    First, build the TypeScript code into JavaScript:
    ```bash
    npm run build
    ```
    Then, start the application using Node:
    ```bash
    npm start
    ```

### Other Useful Commands

*   **Linting:** Check code for style and potential errors.
    ```bash
    npm run lint
    ```
*   **Formatting:** Automatically format code using Prettier.
    ```bash
    npm run format
    ```
*   **Testing:** Run automated tests (if tests are configured in `jest`).
    ```bash
    npm run test
    ```

## API Documentation

API documentation is generated using Swagger UI and is available at the `/api-docs` endpoint when the server is running (e.g., `http://localhost:3000/api-docs`). Explore this endpoint to understand the available RESTful API routes, parameters, and responses.

## WebSocket Protocol

The application uses WebSockets for real-time features.

### Connection

*   Clients connect to the WebSocket server at the `/ws` path (e.g., `ws://localhost:3000/ws`).
*   **Authentication:** A valid JWT must be provided as a query parameter named `token` during the connection handshake.
    ```
    ws://localhost:3000/ws?token=YOUR_VALID_JWT_TOKEN
    ```
    Connections without a valid token will be rejected.
*   **Keep-Alive:** The server uses a ping/pong mechanism every 30 seconds to detect and terminate stale connections. Clients should respond to pings with pongs to maintain the connection.

### Message Structure

Messages exchanged over WebSockets generally follow this JSON structure:

```json
{
  "type": "MESSAGE_TYPE_ENUM",
  "payload": { ... } // Data specific to the message type
}
```

### Message Types (`WebSocketMessageType`)

The following message types are handled by the server (sent from client or broadcasted by server):

*   `NEW_MESSAGE`: Broadcasted by the server when a new chat message is created. Payload contains message details.
*   `TYPING`: Sent by the client to indicate typing status. Broadcasted to other chat participants.
    *   Payload: `{ chatId: string, isTyping: boolean, participantIds: string[] }`
*   `READ_RECEIPT`: Sent by the client when they read messages. Broadcasted to relevant participants.
    *   Payload: `{ chatId: string, messageId: string, participantIds: string[] }`
*   `USER_STATUS`: Broadcasted by the server when a user's connection status changes (online/offline).
    *   Payload: `{ userId: string, status: 'online' | 'offline', timestamp: string }`
*   `CHAT_CREATED`: Potentially broadcasted when a new chat is created (verify specific implementation).
*   `ERROR`: Sent by the server to a specific client if an error occurs processing their message (e.g., invalid format).
    *   Payload: `{ message: string }`

## Configuration

Application configuration is managed via environment variables, loaded using the `dotenv` library.

*   The primary configuration file is `src/config/index.ts`, which reads `process.env` variables and provides a typed `config` object used throughout the application.
*   A `.env` file in the project root is used to store sensitive information and environment-specific settings during development. **Do not commit the `.env` file to version control.** Use a `.env.example` file to document required variables.

## Logging

*   Logging is implemented using the **Winston** library (`src/utils/logger.ts`).
*   **Transports:** Logs are output to:
    *   The console (with colors and timestamps, level based on `NODE_ENV`).
    *   `logs/error.log`: Only errors are logged here.
    *   `logs/combined.log`: All logs (based on the configured level) are logged here.
*   **Levels:** Standard log levels (error, warn, info, http, debug) are used. The logging level is set to `debug` in development and `info` in production.
*   **Format:** Console logs are formatted for readability, while file logs are stored in JSON format.

## Error Handling

*   A global error handling middleware is defined in `src/api/middlewares/errorHandler.ts`.
*   It catches errors passed via `next(err)` in Express routes.
*   A `catchErrors` utility wraps asynchronous route handlers to ensure their promises' rejections are caught and passed to the global handler.
*   In **development**, detailed error messages including stack traces are returned in the API response.
*   In **production**, generic error messages are returned for non-operational errors to avoid leaking sensitive information, while operational errors (expected issues) might return more specific messages. All errors are logged regardless of the environment.

## Security

Several security measures are implemented:

*   **Helmet:** Sets various HTTP headers to protect against common web vulnerabilities (e.g., XSS, clickjacking).
*   **CORS:** Configured using the `cors` middleware to control which origins are allowed to access the API.
*   **JWT Authentication:** Secures API endpoints and WebSocket connections, ensuring only authenticated users can access resources or establish real-time connections.
*   **Rate Limiting:** Uses `express-rate-limit` to limit the number of requests from a single IP address, mitigating brute-force and denial-of-service attacks.
*   **Input Validation:** Uses `Joi` to validate incoming request data (body, query, params) against predefined schemas, preventing invalid or malicious data from being processed.
*   **Environment Variables:** Sensitive information like API keys and database credentials are stored securely in environment variables, not hardcoded in the source code.

## Docker Support

*   A `dockerfile` is included in the root directory, allowing you to build a Docker image for the application.
*   A `.dockerignore` file specifies files and directories to exclude from the image build context, optimizing the image size.
*   To build the image: `docker build -t chat-app .`
*   To run the container (ensure required environment variables are passed, e.g., via `-e` flags or a `.env` file): `docker run -p 3000:3000 --env-file .env chat-app` (adjust port mapping and env file as needed).
