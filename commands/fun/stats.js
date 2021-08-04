const gameNames = {uno: "Uno", tictactoe: "Tic Tac Toe", rps: "Rock Paper Scissors"}
module.exports = {
	name: 'stats',
	description: 'Get game stats for a user.',
	cooldown: 5,
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
      choices: Object.entries(gameNames).map(([key, value]) => ({
        name: value,
        value: key
      }))
    }
  ],
	async execute(interaction) {
    const user = interaction.options.getUser('user');
    const game = interaction.options.getString('game');
    const stats = client.user_data.get(user.id, `stats.${gameName}`)
		await interaction.reply({content: `Stats for <@${user.id}> in ${gameNames[game]}:\nGames played: ${stats.played}\nWins: ${stats.wins}`, allowedMentions: {parse: []}});
	},
};