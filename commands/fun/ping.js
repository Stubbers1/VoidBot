module.exports = {
	name: 'ping',
	description: 'Ping!',
	cooldown: 30,
	async execute(interaction) {
		await interaction.reply({content: `Pong!\n💟 **Heartbeat**: ${Math.round(client.ws.ping)} ms`, ephemeral: true});
		return true;
	}
};