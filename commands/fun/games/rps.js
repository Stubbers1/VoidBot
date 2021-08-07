const Enmap = require('enmap');

const game_states = new Enmap({
  name: "rps_games",
  fetchAll: true,
  autoFetch: true,
  cloneLevel: 'deep'
});

const choicesMap = ['rock', 'paper', 'scissors']

module.exports = [
  {
    name: 'game rps',
    description: 'Challenge someone to rock paper scissors',
    cooldown: 60,
    options: [
      {
        name: 'opponent',
        type: 'USER',
        description: "The user to challenge",
        required: true
      }
    ],
    async execute(interaction) {
      const challenger = interaction.user
      const opponent = interaction.options.getUser('opponent', true)
      if (challenger.id === opponent.id) return await interaction.reply({content: "You can't challenge yourself!", ephemeral: true})
      await interaction.defer()
      let content = `<@${challenger.id}> challenges <@${opponent.id}> to a game of rock paper scissors!`
      await interaction.editReply({
        content: content,
        components: [
          {
            type: 'ACTION_ROW',
            components: [
              {
                type: 'BUTTON',
                label: 'Rock',
                style: 'PRIMARY',
                emoji: '🪨',
                custom_id: `rps-0-${challenger.id}-${opponent.id}`
              },
              {
                type: 'BUTTON',
                label: 'Paper',
                style: 'PRIMARY',
                emoji: '📄',
                custom_id: `rps-1-${challenger.id}-${opponent.id}`
              },
              {
                type: 'BUTTON',
                label: 'Scissors',
                style: 'PRIMARY',
                emoji: '✂️',
                custom_id: `rps-2-${challenger.id}-${opponent.id}`
              }
            ]
          }
        ]
      });
      game_states.set(interaction.id, [null, opponent.id === client.user.id ? getRandomInt(0, 3) : null])
      return true;
    }
  },
  async (interaction) => {
    if (!interaction.isButton()) return;
    
    const custom_id = interaction.customId
    if (!custom_id.startsWith('rps-')) return;
    const split = custom_id.split('-');
    if (split.length !== 4) return;
    const [ , choiceString, challengerId, opponentId ] = split;
    const choice = parseInt(choiceString, 10)

    if (interaction.user.id !== challengerId && interaction.user.id !== opponentId) return await interaction.reply({content: "You're not part of this game!", ephemeral: true}) || true;
    
    if (!game_states.has(interaction.message.interaction.id)) return await interaction.update({components: []}) || true;
    const index = (interaction.user.id === opponentId) ? 1 : 0
    const currentChoice = game_states.get(interaction.message.interaction.id, index)
    if (currentChoice !== null) return await interaction.reply({content: "You've already played!", ephemeral: true}) || true;

    game_states.set(interaction.message.interaction.id, choice, index)
    const oppositionChoice = game_states.get(interaction.message.interaction.id, index ? 0 : 1)
    if (oppositionChoice === null) return await interaction.reply({content: `You chose ${choicesMap[choice]}.`, ephemeral: true}) || true;

    const [ challengerChoice, opponentChoice ] = game_states.get(interaction.message.interaction.id)
    game_states.delete(interaction.message.interaction.id)

    let content = `<@${challengerId}> chose **${choicesMap[challengerChoice]}**.\n<@${opponentId}> chose **${choicesMap[opponentChoice]}**.\n`
    client.user_data.ensure(challengerId)
    client.user_data.ensure(opponentId)
    client.user_data.inc(challengerId, 'stats.rps.played')
    client.user_data.inc(opponentId, 'stats.rps.played')
    if (challengerChoice === opponentChoice) {
      content += `Draw!`
    } else if (challengerChoice === (opponentChoice + 1) % 3) {
      client.user_data.inc(challengerId, 'stats.rps.wins')
      content += `<@${challengerId}> wins!`
    } else {
      client.user_data.inc(opponentId, 'stats.rps.wins')
      content += `<@${opponentId}> wins!`
    }
    return await interaction.update({content: content, allowedMentions: {parse: []}, components: []}) || true;
  }
];