const sides = ['heads', 'tails']

module.exports = {
	name: 'coin',
	description: 'Flip a coin',
	cooldown: 5,
	async execute(interaction) {
		return await interaction.reply(sides[getRandomInt(0, 2)]) || true;
	}
};