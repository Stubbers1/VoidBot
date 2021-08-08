const Enmap = require('enmap');
const getValue = label => label === 'X' ? 1 : (label === 'O' ? -1 : 0)

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

const user_stats = new Enmap({
	name: 'tictactoe_stats',
	fetchAll: false,
  autoFetch: true,
  cloneLevel: 'deep',
  autoEnsure: {
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0
  }
});

module.exports = [
  {
    name: 'game tictactoe',
    description: 'Challenge someone to tic tac toe',
    cooldown: 30,
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
      if (challenger.id === opponent.id) return await interaction.reply({content: "You can't challenge yourself!", ephemeral: true}) && false;
      let content = `<@${challenger.id}> (X) challenges <@${opponent.id}> (O) to a game of tic tac toe! <@${opponent.id}> will play first.`
      const components = [
        {
          type: 'ACTION_ROW',
          components: [
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-00-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-01-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-02-${challenger.id}-${opponent.id}`},
          ]
        },
        {
          type: 'ACTION_ROW',
          components: [
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-10-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-11-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-12-${challenger.id}-${opponent.id}`},
          ]
        },
        {
          type: 'ACTION_ROW',
          components: [
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-20-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-21-${challenger.id}-${opponent.id}`},
            {type: 'BUTTON', label: '-', style: 'SECONDARY', custom_id: `tictactoe-22-${challenger.id}-${opponent.id}`},
          ]
        },
      ]
      // if the opponent is the bot, make a random move
      if (opponent.id === client.user.id) {
        const i = getRandomInt(0, 3)
        const j = getRandomInt(0, 3)

        Object.assign(components[i].components[j], {label: 'O', style: 'DANGER', disabled: true})

        content = `<@${challenger.id}> (X) has challenged me (O) to a game of tic-tac-toe! I've made my first move.`
      }
      await interaction.reply({
        content: content,
        components: components,
        allowedMentions: {users: [(opponent.id === client.user.id) ? challenger.id : opponent.id]}
      });
      return true;
    }
  },
  async (interaction) => {
    if (!interaction.isButton()) return;

    const custom_id = interaction.customId
    if (!custom_id.startsWith('tictactoe-')) return;
    const split = custom_id.split('-')
    if (split.length !== 4) return;
    const [ , , challengerId, opponentId ] = split;

    let challenger_plays = 0, opponent_plays = 0;

    let finished = true
    let buttonPressed
    // count the plays already made by each player & check if the entire board is disabled
    let components = interaction.message.components
    if ((typeof interaction.message.components[0].toJSON) === 'function') {
      components = components.map(component => component.toJSON())
    }
    for (let actionRow of components) {
      for (let button of actionRow.components) {
        if (button.label === 'X') challenger_plays++;
        if (button.label === 'O') opponent_plays++;
        if (button.custom_id === custom_id) buttonPressed = button
        finished = finished && button.disabled
      }
    }

    if (finished || opponent_plays === 5) return await interaction.reply({content: "This game is over!", ephemeral: true}) || true;

    let challenger_turn = challenger_plays < opponent_plays;
    if ((challenger_turn ? challengerId : opponentId) !== interaction.user.id) return await interaction.reply({content: "It isn't your turn!", ephemeral: true}) || true;

    if (buttonPressed.label !== '-') return await interaction.reply({content: "You must play in an empty space!", ephemeral: true}) || true;

    // update the button
    buttonPressed.label = challenger_turn ? 'X' : 'O';
    buttonPressed.style = challenger_turn ? "SUCCESS" : "DANGER";
    buttonPressed.disabled = true;

    // increment the number of plays made
    if (challenger_turn) {
      challenger_plays++;
    } else {
      opponent_plays++;
    }
    challenger_turn = !challenger_turn // swap the turn

    let botPlayCoords;
    // if the bot player needs to make a move
    // note that we haven't checked if the human player has won yet; we'll revert this play if they have
    if (opponentId === client.user.id) {
      const options = 9 - challenger_plays - opponent_plays
      if (options > 0) { // this check should never fail because the bot plays first and last
        const chosen_position = getRandomInt(0, options) + 1 // pick a random space given the number of options
        let current_position = 0
        // loop through the components to find the nth empty space according to chosen_position
        outerLoop:
          for (let actionRow of components) {
            for (let button of actionRow.components) {
              if (button.label === '-') current_position++;
              if (current_position === chosen_position) {
                button.label = 'O';
                button.style = 'DANGER';
                button.disabled = true;
                botPlayCoords = button.custom_id.split('-')[1]
                break outerLoop;
              }
            }
          }
        opponent_plays++; // increment the number of plays made
        challenger_turn = !challenger_turn; // swap the turn (again)
      }
    }

    // check if someone has won
    let winner = undefined

    // check the rows
    for(var i = 0; i < 3; i++){
      var rowSum = 0;
      for (var j = 0; j < 3; j++) {
        rowSum += getValue(components[i].components[j].label)
      }
      if (rowSum === 3) winner = challengerId
      if (winner !== challengerId && rowSum === -3) winner = opponentId
    }

    // check the columns
    for(var i = 0; i < 3; i++){
      var colSum = 0;
      for (var j = 0; j < 3; j++) {
        colSum += getValue(components[j].components[i].label)
      }
      if (colSum === 3) winner = challengerId
      if (winner !== challengerId && colSum === -3) winner = opponentId
    }

    if (getValue(components[0].components[0].label) + getValue(components[1].components[1].label) + getValue(components[2].components[2].label) === 3) winner = challengerId
    if (winner !== challengerId && getValue(components[0].components[0].label) + getValue(components[1].components[1].label) + getValue(components[2].components[2].label) === -3) winner = opponentId

    if (getValue(components[2].components[0].label) + getValue(components[1].components[1].label) + getValue(components[0].components[2].label) === 3) winner = challengerId
    if (winner !== challengerId && getValue(components[2].components[0].label) + getValue(components[1].components[1].label) + getValue(components[0].components[2].label) === -3) winner = opponentId
    
    if (winner !== challengerId && challenger_plays + opponent_plays === 9) winner = null // if all

    let content = ""

    if (winner === undefined) {
      content = `<@${challengerId}> (X) is challenging <@${opponentId}> (O). <@${challenger_turn ? challengerId : opponentId}> will play next.`
    } else {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (botPlayCoords && winner === challengerId && botPlayCoords === `${i}${j}`) Object.assign(components[i].components[j], {label: '-', style: 'SECONDARY'})
          components[i].components[j].disabled = true;
        }
      }
      user_stats.ensure(challengerId)
      user_stats.ensure(opponentId)
      user_stats.inc(challengerId, 'played')
      user_stats.inc(opponentId, 'played')
      content = `<@${challengerId}> (X) challenged <@${opponentId}> (O) - `
      if (winner === null) {
        content += `the result was a draw.`
        user_stats.inc(challengerId, 'draws')
        user_stats.inc(opponentId, 'draws')
      } else {
        user_stats.inc(winner, 'wins')
        user_stats.inc((winner === challengerId) ? opponentId : challengerId, 'losses')
        content += `<@${winner}> won!`
      }
    }

    await interaction.update({content: content, components: components, allowedMentions: winner === undefined ? {users: [challenger_turn ? opponentId : challengerId]} : {parse: []}});
  },
  {
    name: 'stats tictactoe',
    description: "Get a user's stats for tic tac toe games.",
    async execute(interaction) {
      const user = interaction.options.getUser('user', true);
      user_stats.ensure(user.id);
      const played = user_stats.get(user.id, 'played');
      const wins = user_stats.get(user.id, 'wins');
      const losses = user_stats.get(user.id, 'losses');
      const draws = user_stats.get(user.id, 'draws');
      return await interaction.reply({content: `Tic tac toe stats for <@${user.id}>:
\`\`\`Games played: ${played}
Wins: ${wins}
Losses: ${losses}
Draws: ${draws}\`\`\``, allowedMentions: {parse: []}}) || true;
    }
  }
];