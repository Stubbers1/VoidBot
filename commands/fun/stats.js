module.exports = {
	name: 'stats',
	description: 'Get game stats for a user.',
	cooldown: 30,
  options: [
    {
      name: 'user',
      type: 'USER',
      description: "The user to display stats for.",
      required: true
    },
    {
      name: 'game',
      type: 'STRING',
      description: "The game to display stats for.",
      required: true,
      choices: [
        {
          name: "Uno",
          value: 'uno'
        },
        {
          name: "Tic Tac Toe",
          value: 'tictactoe'
        },
        {
          name: "Rock Paper Scissors",
          value: 'rps'
        }
      ]
    }
  ],
	async execute(interaction) {
    const user = interaction.options.getUser('user');
    const gameName = interaction.options.getString('game');
    const stats = client.user_data.get(user.id, `stats.${gameName}`)
		await interaction.reply({content: `Stats for ${user.tag}:\nGames played: ${stats.played}\nWins: ${stats.wins}`, allowedMentions: {parse: []}});
	},
};