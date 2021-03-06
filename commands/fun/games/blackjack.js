const Enmap = require('enmap');
const valuesMap = [
	'Ace',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'Jack',
	'Queen',
	'King'
];
const suitsMap = ['Hearts', 'Spades', 'Clubs', 'Diamonds'];

function getValue(hand) {
	let value = hand
		.map(x => Math.min((x % 13) + 1, 10))
		.reduce((a, b) => a + b, 0);
	const aces = hand.filter(x => x % 13 === 0).length;
	if (aces && value <= 11) value += 10;
	return value;
}

function getName(card) {
	return `${valuesMap[card % 13]} of ${suitsMap[Math.floor(card / 13)]}`;
}

const user_stats = new Enmap({
	name: 'blackjack_stats',
	fetchAll: false,
	autoFetch: true,
	cloneLevel: 'deep',
	autoEnsure: {
		played: 0,
		bust: 0,
		blackjack: 0
	}
});

module.exports = [
	{
		name: 'game blackjack',
		description: 'Start a game of blackjack',
		cooldown: 30,
		async execute(interaction) {
			const player = interaction.user;
			const deck = Array.from(Array(52).keys());
			const hand = [];
			for (let i = 0; i < 2; i++) {
				hand.push(deck.splice(getRandomInt(0, deck.length), 1)[0]);
			}
			const value = getValue(hand);
			let content = `You got dealt the **${getName(
				hand[0]
			)}** and the **${getName(hand[1])}**.\n`;
			if (value === 21) {
				content += 'Blackjack!';
			} else {
				content += `Value: ${value}\nChoose to hit (get another card) or stick (stop with your current hand):`;
			}
			const components = [
				{
					type: 'ACTION_ROW',
					components: [
						{
							type: 'BUTTON',
							label: 'Hit',
							custom_id: `blackjack-hit-${player.id}-${hand.join(',')}`,
							style: 'DANGER'
						},
						{
							type: 'BUTTON',
							label: 'Stick',
							custom_id: `blackjack-stick-${player.id}-${hand.join(',')}`,
							style: 'PRIMARY'
						}
					]
				}
			];
			return (
				(await interaction.reply({
					content: content,
					components: value === 21 ? [] : components
				})) || true
			);
		}
	},
	async interaction => {
		if (!interaction.isButton()) return;

		const custom_id = interaction.customId;
		if (!custom_id.startsWith('blackjack-')) return;
		const split = custom_id.split('-');
		if (split.length !== 4) return;
		const [, action, playerId, handString] = split;
		if (interaction.user.id !== playerId)
			return (
				(await interaction.reply({
					content: "You didn't start this game!",
					ephemeral: true
				})) || true
			);

		const hand = handString.split(',').map(card => parseInt(card, 10));
		const deck = Array.from(Array(52).keys()).filter(
			card => !hand.includes(card)
		);

		if (action === 'hit')
			hand.push(deck.splice(getRandomInt(0, deck.length), 1)[0]);

		const value = getValue(hand);

		let content = `Hand: **${hand.map(getName).join('**, **')}**.\n`;

		let components = [];
		user_stats.ensure(interaction.user.id);
		if (value === 21) {
			content += 'Blackjack!';
			user_stats.inc(interaction.user.id, 'blackjack');
		} else if (value > 21) {
			content += 'Bust!';
			user_stats.inc(interaction.user.id, 'bust');
		} else {
			content += `Value: ${value}`;
			if (action === 'hit') {
				components = interaction.message.components;
				if (typeof interaction.message.components[0].toJSON === 'function') {
					components = components.map(component => component.toJSON());
				}
				components[0].components[0].custom_id = `blackjack-hit-${playerId}-${hand.join(
					','
				)}`;
				components[0].components[1].custom_id = `blackjack-stick-${playerId}-${hand.join(
					','
				)}`;
			}
		}

		if (components.length === 0) {
			user_stats.inc(interaction.user.id, 'played');
		}

		return (
			(await interaction.update({
				content: content,
				components: components
			})) || true
		);
	},
	{
		name: 'stats blackjack',
		description: "Get a user's stats for blackjack games.",
		async execute(interaction) {
			const user = interaction.options.getUser('user');
			user_stats.ensure(user.id);
			const played = user_stats.get(user.id, 'played');
			const bust = user_stats.get(user.id, 'bust');
			const blackjack = user_stats.get(user.id, 'blackjack');
			return (
				(await interaction.reply({
					content: `Blackjack stats for <@${user.id}>:
\`\`\`Games played: ${played}
Went bust: ${bust}
Got blackjack: ${blackjack}\`\`\``,
					allowedMentions: { parse: [] }
				})) || true
			);
		}
	}
];
