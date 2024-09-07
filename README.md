# A mahjong score tracker for UW Mahjong Club

## Installation
Clone the repo and install packages

    $ git clone https://github.com/sunmingyang0115/riichinya-v2
    $ cd riichinya-v2
    $ npm install

## Setup

Create `.env` in project root folder

    TOKEN=...      # set field to your discord bot token
    CLIENT_ID=...  # set field to your discord bot id

Create `bot_properties.json` in project root folder

    {
      "activeGuilds": [...],
      "writeAccess": [...],
      "prefix": ...,
      "helpPrefix": ...
    }

- activeGuilds - list of discord guild ids to be registered for discord interaction (Used for score insertion)
- writeAccess - list of discord user ids that have permission to use insert scores
- prefix - the bot prefix for general commands
- helpPrefix - the bot prefix for documentation

## Build and Run

    $ tsc
    $ npm run dev


