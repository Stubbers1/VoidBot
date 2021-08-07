const sides = ['heads', 'tails']

module.exports = {
	name: 'coin',
	description: 'Flip a coin',
	cooldown: 5,
	async execute(interaction) {
		await interaction.reply(sides[getRandomInt(0, 2)]);
	}
};