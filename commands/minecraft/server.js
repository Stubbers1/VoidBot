const spawn = require('child_process').spawn;
const fs = require('fs');
const path = require('path');
const stayAwake = require('stay-awake');
const chokidar = require('chokidar');

var server_process = null
var started = false

const serversFolderPath = path.join(__dirname, "../../servers")
const minecraftServerFolders = fs.readdirSync(serversFolderPath, { withFileTypes: true }).filter(dirent => dirent.isDirectory())
const aliases = {}

const getChoices = () => Object.entries(aliases).map(e => ({name: e[1], value: e[0]})).sort((a, b) => a.name < b.name ? -1 : (a.name > b.name ? 1 : 0))

for (let i = 0; i < minecraftServerFolders.length; i++) {
  const dirName = minecraftServerFolders[i].name
  const dirPath = path.join(serversFolderPath, dirName)
  if (!fs.existsSync(path.join(dirPath, "server.jar"))) continue;
  let alias = dirName
  if (fs.existsSync(path.join(dirPath, "alias.txt"))) alias = fs.readFileSync(path.join(dirPath, "alias.txt"), {encoding: "utf8"}) || alias
  aliases[dirName] = alias
}

// the following code watches for updates to servers and their aliases in order to update the command choices whenever this happens

async function updateApplicationCommands() {
  const commandModule = client.commands.get('server')
  commandModule.options[0].options[0].choices = getChoices()
  const commandIds = client.command_data.get('server', 'ids')
  for (const guildId of Object.keys(commandIds)) {
    const commandId = commandIds[guildId]
    client.application.commands.edit(commandId, commandData, guildId);
  }
}

const watcher = chokidar.watch(serversFolderPath.replace('\\', '/'), {
  ignoreInitial: true,
  depth: 1
})

watcher.on('addDir', async dirPath => {
  if (!fs.existsSync(path.join(dirPath, "server.jar"))) return;
  const lastIndex = dirPath.lastIndexOf('\\')
  const dirName = dirPath.substring(lastIndex + 1);
  let alias = dirName
  if (fs.existsSync(path.join(dirPath, "alias.txt"))) alias = fs.readFileSync(path.join(dirPath, "alias.txt"), {encoding: "utf8"})?.trim() || alias
  aliases[dirName] = alias
  await updateApplicationCommands()
})

watcher.on('unlinkDir', async dirPath => {
  const lastIndex = dirPath.lastIndexOf('\\')
  const dirName = dirPath.substring(lastIndex + 1)

  if (Object.keys(aliases).includes(dirName)) {
    delete aliases[dirName]
    await updateApplicationCommands()
  }
})

watcher.on('add', async filePath => {
  const lastIndex = filePath.lastIndexOf('\\')
  const fileName = filePath.substring(lastIndex + 1)
  const dirPath = filePath.substring(0, lastIndex)
  const dirLastIndex = dirPath.lastIndexOf('\\')
  const dirName = filePath.substring(dirLastIndex + 1, lastIndex)

  if (fileName === 'alias.txt') {
    if (!Object.keys(aliases).includes(dirName)) return;
    let alias = dirName
    alias = fs.readFileSync(filePath, {encoding: "utf8"})?.trim() || alias
    aliases[dirName] = alias
    await updateApplicationCommands();
    return;
  }

  if (Object.keys(aliases).includes(dirName) || fileName !== 'server.jar') return;

  let alias = dirName
  if (fs.existsSync(path.join(dirPath, "alias.txt"))) alias = fs.readFileSync(path.join(dirPath, "alias.txt"), {encoding: "utf8"})?.trim() || alias
  aliases[dirName] = alias
  await updateApplicationCommands()
})

watcher.on('unlink', async filePath => {
  const lastIndex = filePath.lastIndexOf('\\')
  const fileName = filePath.substring(lastIndex + 1)
  const dirPath = filePath.substring(0, lastIndex)
  const dirLastIndex = dirPath.lastIndexOf('\\')
  const dirName = filePath.substring(dirLastIndex + 1, lastIndex)

  if (fileName === 'alias.txt') {
    if (!Object.keys(aliases).includes(dirName)) return;
    aliases[dirName] = dirName
    await updateApplicationCommands();
    return;
  }

  if (!Object.keys(aliases).includes(dirName) || fileName !== 'server.jar') return;

  delete aliases[dirName];
  await updateApplicationCommands();
})

watcher.on('change', async filePath => {
  const lastIndex = filePath.lastIndexOf('\\')
  const fileName = filePath.substring(lastIndex + 1)
  const dirPath = filePath.substring(0, lastIndex)
  const dirLastIndex = dirPath.lastIndexOf('\\')
  const dirName = filePath.substring(dirLastIndex + 1, lastIndex)

  if (fileName !== 'alias.txt' || !Object.keys(aliases).includes(dirName)) return;
  
  let alias = dirName
  alias = fs.readFileSync(filePath, {encoding: "utf8"})?.trim() || alias
  aliases[dirName] = alias
  await updateApplicationCommands();
})

module.exports = {
	name: 'server',
  description: "Minecraft server-related commands.",
  cooldown: 0,
  guilds: ['819595876687151165', '690875821552042054', '785952005649596416'],
  options: [
    {
      type: 'SUB_COMMAND',
      name: 'start',
      description: "Start a Minecraft server",
      options: [
          {
            type: 'STRING',
            name: 'name',
            description: "Name of the server to start",
            choices: getChoices(),
            required: true
          }
        ]
    },
    {
        type: 'SUB_COMMAND',
        name: 'stop',
        description: "Stop the currently active Minecraft server"
    }
  ],
	async execute(interaction) {
    await interaction.defer({ephemeral: true})
    const subCommand = interaction.options.getSubCommand();
    switch (subCommand) {
      case 'start':
        const name = interaction.options.getString('name', true)
        if (server_process !== null) return await interaction.editReply("A server is already running.")
        if (!/^[\w.]+$/.test(name)) return await interaction.editReply("Invalid server name.")
        if (!fs.existsSync(path.join(serversFolderPath, name))) return await interaction.editReply("That server doesn't exist.")
        await interaction.editReply(`Starting server ${aliases[name]}...`)
        stayAwake.prevent();
        server_process = spawn(`java`, ["-jar", "server.jar", "nogui"], {cwd: path.join(serversFolderPath, name)});
        async function checkData(data) {
          if (/\[\d{2}:\d{2}:\d{2} INFO\]: Timings Reset/.test(data.toString())) {
            await interaction.followUp({content: "Server started!", ephemeral: true})
            server_process.stdout.off('data', checkData)
            started = true;
          }
        }
        server_process.stdout.on('data', checkData)
        server_process.stdout.pipe(process.stdout)
        break;
      case 'stop':
        if (server_process === null) return await interaction.editReply("There isn't a server to stop.")
        if (!started) return await interaction.editReply("The server hasn't started yet!")
        await interaction.editReply("Stopping server...");
        server_process.on('close', async () => {
          server_process = null;
          started = false;
          stayAwake.allow();
          await interaction.followUp({content: "Server stopped.", ephemeral: true});
        });
        server_process.stdin.write("stop\n")
        break;
    }
	},
};