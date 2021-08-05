// load all the commands found in the commands folder
const gameFiles = fs.readdirSync('../../games');

const games = []

for (const fileName of gameFiles) {
	const gameModule = require(`../../games/${fileName}`);
	games.push(gameModule)
}