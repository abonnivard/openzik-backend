# OpenZik Backend

This backend handles search, download, and music library management for the OpenZik application.

## Main Features
- Search for artists, tracks, albums, playlists, and Spotify profiles
- Download tracks, albums, and playlists
- Map downloads to the user's library
- Direct playback of music from the library
- User authentication and account management

## Project Structure
```

├── index.js                # Main entry point
├── routes/                 # API routes (auth, download, library, player, search)
├── services/               # Services (db, spotify, scanner, etc.)
├── utils/                  # Utilities (file management, etc.)
├── downloads/              # Downloaded files folder
├── music/                  # Organized music folder
├── .env                    # Environment variables
├── package.json            # Node.js dependencies
```

## Installation
1. Install Node.js and npm
2. Clone the repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure the `.env` file (see example)
5. Start the server:
   ```bash
   npm start
   ```

## API Endpoints
- `/search` : Spotify search
- `/download` : Download
- `/library` : User library
- `/player` : Audio playback
- `/auth` : Authentication

## Configuration
- Downloads are stored in `downloads/`
- Organized music is in `music/`
- Sensitive variables are in `.env`

## Contribution
- Fork, create a branch, submit a pull request
- Follow the project structure and conventions

## License
MIT
