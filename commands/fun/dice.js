module.exports = {
	name: 'dice',
	description: 'Roll a die',
	cooldown: 5,
	options: [
		{
			name: 'type',
			type: 'INTEGER',
			description: 'What type of die to use',
			choices: [
				{ name: 'D4', value: 4 },
				{ name: 'D6', value: 6 },
				{ name: 'D8', value: 8 },
				{ name: 'D10', value: 10 },
				{ name: 'D12', value: 12 },
				{ name: 'D20', value: 20 }
			]
		},
		{
			name: 'number',
			type: 'INTEGER',
			description: 'How many dice to roll'
		}
	],
	async execute(interaction) {
		const max = interaction.options.getInteger('type') ?? 6;
		const number = interaction.options.getInteger('number') ?? 1;
		if (number < 1)
			return (
				(await interaction.reply({
					content: 'You must roll a positive number of dice!',
					ephemeral: true
				})) || true
			);
		if (number > 10)
			return (
				(await interaction.reply({
					content: 'You cannot roll more than 10 dice at once.',
					ephemeral: true
				})) || true
			);
		if (number === 1)
			return (
				(await interaction.reply(getRandomInt(1, max + 1).toString())) || true
			);
		const rolls = [];
		for (let i = 0; i < number; i++) {
			rolls.push(getRandomInt(1, max + 1));
		}
		const sum = rolls.reduce((a, b) => a + b, 0);
		return (
			(await interaction.reply(rolls.join(', ') + `\nTotal: ${sum}`)) || true
		);
	}
};
