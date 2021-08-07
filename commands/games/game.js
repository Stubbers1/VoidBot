// load all the commands found in the commands folder
const gameFiles = fs.readdirSync('../../games');

const games = []

module.exports = {
	name: 'game',
	description: "Various games to play using interactions."
}

for (const fileName of gameFiles) {
	const gameModule = require(`../../games/${fileName}`);
	games.push(gameModule)
}