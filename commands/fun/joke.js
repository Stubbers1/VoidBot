const JokeAPI = require('sv443-joke-api');

module.exports = {
	name: 'joke',
	description: 'Send a joke',
	cooldown: 10,
	async execute(interaction) {
		await interaction.defer()
    const joke = await (await JokeAPI.getJokes()).json()
		let message = joke.joke ?? joke.setup
		if (joke.type == 'twopart') {
			message += `\n\n||${joke.delivery}||`
		}
		await interaction.editReply(message + `\nSource: https://sv443.net/jokeapi/v2/`)
	},
};