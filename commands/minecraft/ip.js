const publicIp = require('public-ip')

module.exports = {
	name: 'ip',
	description: 'Get the Minecraft server\'s IP address',
	cooldown: 60,
  guilds: ['819595876687151165', '690875821552042054', '785952005649596416'],
	async execute(interaction) {
    const ip = await publicIp.v4();
    await interaction.reply({content: `The Minecraft server IP is thevoidmc.ga. If that doesn't work, try ${ip}:25564`, ephemeral: true})
	},
};