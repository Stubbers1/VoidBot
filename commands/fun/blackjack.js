const valuesMap = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"]
const suitsMap = ["Hearts", "Spades", "Clubs", "Diamonds"]

function getValue(hand) {
  let value = hand.map(x => Math.min((x % 13) + 1, 10)).reduce((a, b) => a + b, 0)
  const aces = hand.filter(x => (x % 13) === 0).length;
  if (aces && value <= 11) value += 10;
  return value;
}

function getName(card) {
  return `${valuesMap[card % 13]} of ${suitsMap[Math.floor(card / 13)]}`
}

module.exports = {
	name: 'blackjack',
	description: 'Start a game of blackjack',
	cooldown: 60,
	async execute(interaction) {
    const player = interaction.user
    const deck = Array.from(Array(52).keys())
    const hand = []
    for (let i = 0; i < 2; i++) {
      hand.push(deck.splice(getRandomInt(0, deck.length), 1)[0]);
    }
    const value = getValue(hand);
    let content = `You got dealt the **${getName(hand[0])}** and the **${getName(hand[1])}**.\nValue: ${value}`
    if (value === 21) content += " - Blackjack!";
    const components = [
      {
        type: 'ACTION_ROW',
        components: [
          {
            type: 'BUTTON',
            label: 'Stick',
            custom_id: `blackjack-stick-${player.id}-${hand.join(',')}`,
            style: 'PRIMARY'
          },
          {
            type: 'BUTTON',
            label: 'Hit',
            custom_id: `blackjack-hit-${player.id}-${hand.join(',')}`,
            style: 'DANGER'
          }
        ]
      }
    ]
    await interaction.reply({
      content: content,
      components: (value === 21) ? [] : components
    });
	},
  async executeComponent(interaction) {
    if (!interaction.isButton()) return;
    
    const custom_id = interaction.customId;
    const [ game, action, playerId, handString ] = custom_id.split('-');
    if (interaction.user.id !== playerId) return await interaction.reply({content: "You didn't start this game!", ephemeral: true});

    await interaction.deferUpdate()
    
    const hand = handString.split(',').map(card => parseInt(card))
    const deck = Array.from(Array(52).keys()).filter(card => !hand.includes(card))

    if (action === "hit") hand.push(deck.splice(getRandomInt(0, deck.length), 1)[0]);

    const value = getValue(hand);

    let content = `Hand: **${hand.map(getName).join('**, **')}**.\nValue: ${value}`

    if (value === 21) content += "\nBlackjack!"
    if (value > 21) content += "\nBust!"
    if (action === "stick") content += "\nYou chose to stick."

    const components = (value >= 21 || action === "stick") ? [] : interaction.message.components.map(component => component.toJSON());
    if (components.length > 0) components[0].components[0].custom_id = `blackjack-stick-${playerId}-${hand.join(',')}`;
    if (components.length > 0) components[0].components[1].custom_id = `blackjack-hit-${playerId}-${hand.join(',')}`;
    
    await interaction.message.edit({content: content, components: components})
  }
};