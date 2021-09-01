# Rally-Twitch-Bot
This bot allows users in twitch chat to perform transactions using $RLY or any creator coin available.

### Links
- [rally.io](https://rally.io/)
- [Registration site to use the bot](https://rallytwitchbot.com/)
- [Rally Discord](https://discord.gg/Ya2ANSMEn6)
- [Rally API docs](https://api-docs.rally.io/)

## Contributing
We encourage you to contribute if you have something you think will add value to creators using this bot. The full process for contributing is still being worked on.  The plan is to provide a test environment with test data and mock APIs to allow developers to contribute without access to the production data. More to come on this.

### Steps to Contribute
1. Fork this repo
2. Clone your fork to your local machine `git clone {your fork}`where {your fork} is the path to your fork
3. Navigate to the directory `cd Twitch-Rally-Bot` for example
4. `npm i` or `npm install` in the Twitch-Rally-Bot directory
5. Run the program `node app.js` for example

**Note:** Without the key and secrets you will not be able to fully use the application.  We are currently working on a solution for this as discussed in the Contributing section.


## App Structure
The application is fairly simple.  There is a few moving parts and external api calls. We will discuss the structure and architecture in the following sections.

### Architecture
(Diagram coming soon)

#### Cloud Services
- Azure Storage - Persistant data storage
- Azure App Service - Server host for: Web site, Bot, API, and clients for 3rd party services 

#### Internal Components

**Note:** There is much room for improvement here.

- app.js
  - contains the server code for the website
  - contains the command detection code for bot commands
     - also contains command code in some cases
- public folder
  - contains the code for the website
- bot.js
  - contains the code to execute most bot commands
  - contains helper methods for bot commands
- rally.js
  - contains the code that makes calls to the rally API
  - contains helper methods for rally http calls
- tableStorage.js
  - contains code for accessing data stored in the data store

### Contact Info
- discord d4rkcide#1505
- email d4rkcide@jack-the.house











