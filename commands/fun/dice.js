module.exports = {
	name: 'dice',
	description: 'Roll a die',
	cooldown: 5,
  options: [
    {
      name: 'type',
      type: 'INTEGER',
      description: "What type of die to use",
      choices: [
        {name: 'D4', value: 4},
        {name: 'D6', value: 6},
        {name: 'D8', value: 8},
        {name: 'D10', value: 10},
        {name: 'D12', value: 12},
        {name: 'D20', value: 20}
      ]
    }
  ],
	async execute(interaction) {
    const max = interaction.options.getInteger('type') ?? 6
		await interaction.reply(getRandomInt(1, max + 1).toString());
    return true;
	},
};