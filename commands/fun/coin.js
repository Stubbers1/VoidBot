const sides = ['heads', 'tails'];

const MAX_NUMBER_COINS = 999;

module.exports = {
	name: 'coin',
	description: 'Flip a coin',
	cooldown: 5,
	options: [
		{
			name: 'number',
			type: 'INTEGER',
			description: 'How many coins to flip'
		}
	],
	async execute(interaction) {
		const number = interaction.options.getInteger('number') ?? 1;
		if (number === 1)
			return (await interaction.reply(sides[getRandomInt(0, 2)])) || true;
		if (number < 1)
			return (
				(await interaction.reply({
					content: 'You must flip a positive number of coins!',
					ephemeral: true
				})) || true
			);
		if (number > MAX_NUMBER_COINS)
			return (
				(await interaction.reply({
					content: `You can't flip more than ${MAX_NUMBER_COINS} at once!`,
					ephemeral: true
				})) || true
			);
		const coins = [];
		let heads = 0;
		let tails = 0;
		for (let i = 0; i < number; i++) {
			const flip = getRandomInt(0, 2);
			if (flip) {
				tails++;
			} else {
				heads++;
			}
			coins.push(sides[flip]);
		}
		return (
			(await interaction.reply(
				`Coins: ${coins.join(', ')}\nHeads: ${heads}\nTails: ${tails}`
			)) || true
		);
	}
};
