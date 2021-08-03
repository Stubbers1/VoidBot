const Enmap = require('enmap');

const colours = ["red", "yellow", "blue", "green"]
const names = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+2", "reverse", "skip", "card", "+4"]

function mod(a, b) {
  return ((a % b) + b) % b
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length,  randomIndex;

  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function getCard(index, wildColour) {
  if (index < 100) {
    return [colours[(index % 4)], names[Math.floor(((index % 25) + 1) / 2)]]
  }
  const card = ["wild", names[(index % 2) + 13]]
  if (wildColour) card.push(wildColour)
  return card
}

function isPlayable(card, topCard, drawRequirement) {
  if (drawRequirement && card[1] !== "+2") return false;
  if (card[0] === "wild" || card[0] === topCard[0] || card[1] === topCard[1]) return true;
  if (topCard[0] === "wild" && card[0] === topCard[2]) return true;
  return false;
}

function incrementTurn(channelId) {
  if (game_states.get(channelId, 'reversed')) return game_states.dec(channelId, 'turn')
  return game_states.inc(channelId, 'turn')
}

const game_states = new Enmap({
  name: "uno_games",
  fetchAll: true,
  autoFetch: true,
  cloneLevel: 'deep'
});
//game_states.clear()

function dealCards(channelId, playerId, no = 1) {
  let deck = game_states.observe(channelId, 'deck')
  const hand = game_states.observe(channelId, `hands.${playerId}`)
  const dealtCards = []
  for (let i = 0; i < no; i++) {
    if (deck.length === 0) {
      deck.push(...game_states.get(channelId, 'discard').slice(1))
      game_states.set(channelId, [game_states.get(channelId, 'discard.0')], 'discard')
      if (deck.length === 0) break;
    }
    dealtCards.push(deck.splice(getRandomInt(0, deck.length), 1)[0])
    hand.push(dealtCards[i]);
  }
  return dealtCards
}

function discardCard(channelId, playerId, cardIndex) {
  game_states.remove(channelId, cardIndex, `hands.${playerId}`)
  const discard = game_states.observe(channelId, 'discard')
  discard.unshift(cardIndex)
}

const join_game_button = {
  type: 'BUTTON',
  label: "Join",
  style: 'SUCCESS',
  custom_id: 'uno-join'
}

const leave_game_button = {
  type: 'BUTTON',
  label: "Leave",
  style: 'DANGER',
  custom_id: 'uno-leave'
}

const start_game_button = {
  type: 'BUTTON',
  label: "Start Game",
  style: 'PRIMARY',
  custom_id: 'uno-start'
}

const cancel_game_button = {
  type: 'BUTTON',
  label: "Cancel Game",
  style: 'SECONDARY',
  custom_id: 'uno-cancel'
}

const view_hand_button = {
  type: 'BUTTON',
  label: 'View Hand',
  style: 'PRIMARY',
  custom_id: 'uno-hand'
}

module.exports = {
	name: 'uno',
	description: 'Creates an Uno game',
	cooldown: 10,
  guild_only: true,
	async execute(interaction) {
    const channelId = interaction.channelId
    if (game_states.has(channelId)) return await interaction.reply({content: "There is already a game in this channel!", ephemeral: true})

    game_states.set(channelId, {owner: interaction.user.id, players: []})
    await interaction.reply({
      content: "An Uno game is starting!",
      components: [
        {
          type: 'ACTION_ROW',
          components: [join_game_button, leave_game_button]
        },
        {
          type: 'ACTION_ROW',
          components: [start_game_button, cancel_game_button]
        }
      ]
    })
    return;
	},
  async executeComponent(interaction) {
    if (!interaction.isButton()) return;
    
    const custom_id = interaction.customId;
    const channelId = interaction.channelId;
    if (!game_states.has(channelId)) return await interaction.reply({content: "There isn't an Uno game here.", ephemeral: true});

    let players, numPlayers, dealtCards, hand, topCardIndex, wildColour, newDrawRequirement, topCard, turn, playerIndex, components, chosenCardIndexString, chosenCardIndex, chosenCard, isTurn, chosenColour
    let actionType = custom_id.split('-')[1]
    let content = ""
    switch (custom_id.split('-')[1]) {
      case 'join':
        if (game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're already in this game!", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        await interaction.defer()
        game_states.push(channelId, interaction.user.id, 'players')

        players = game_states.get(channelId, 'players')
        numPlayers = players.length

        return await interaction.editReply({content: `<@${interaction.user.id}> joined the game!`, allowedMentions: {parse: []}});
      case 'leave':
        if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        await interaction.defer()
        game_states.remove(channelId, interaction.user.id, 'players')

        players = game_states.get(channelId, 'players')
        numPlayers = players.length

        return await interaction.editReply({content: `<@${interaction.user.id}> left the game.`, allowedMentions: {parse: []}});
      case 'start':
        if (game_states.get(channelId, 'owner') !== interaction.user.id && !interaction.member.permissionsIn(interaction.channel).has('MANAGE_CHANNELS')) return await interaction.reply({content: "Only the user who created the game can start it.", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        players = game_states.get(channelId, 'players')
        numPlayers = players.length
        if (2 > numPlayers || numPlayers > 10) return await interaction.reply({content: "An Uno game must have 2-10 players to start.", ephemeral: true});
        game_states.set(channelId, 0, 'turn')
        game_states.set(channelId, false, 'reversed')

        topCardIndex = getRandomInt(0, 4) * 25 + getRandomInt(0, 19);
        topCard = getCard(topCardIndex)
        game_states.set(channelId, [topCardIndex], 'discard')

        game_states.set(channelId, Array.from(Array(108).keys()).filter(card => card !== topCardIndex), 'deck');

        for (let i = 0; i < numPlayers; i++) {
          const playerId = players[i]
          game_states.set(channelId, [], `hands.${playerId}`)
          dealCards(channelId, playerId, 7)
        }

        players = game_states.observe(channelId, 'players')
        shuffle(players)

        await interaction.reply({
          content: `<@${interaction.user.id}> started the game. Turn order: <@${players.join('>, <@')}>.\n<@${players[0]}> will play first, and the top card is a **${topCard.join(" ")}**.`,
          components: [
            {
              type: 'ACTION_ROW',
              components: [view_hand_button]
            }
          ],
          allowedMentions: {users: players}
        })
        return;
      case 'cancel':
        if (game_states.get(channelId, 'owner') !== interaction.user.id && !interaction.member.permissionsIn(interaction.channel).has('MANAGE_CHANNELS')) return await interaction.reply({content: "Only the user who created the game can cancel it.", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        game_states.delete(channelId)
        return await interaction.reply(`The game was cancelled by <@${interaction.user.id}>.`)
      case 'hand':
        if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
        if (!game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game hasn't started yet!", ephemeral: true});
        turn = game_states.get(channelId, 'turn');
        players = game_states.get(channelId, 'players')
        numPlayers = players.length
        playerIndex = game_states.get(channelId, 'players').indexOf(interaction.user.id);
        hand = game_states.get(channelId, `hands.${interaction.user.id}`);
        topCardIndex = game_states.get(channelId, 'discard.0');
        wildColour = game_states.get(channelId, 'wild_colour')
        topCard = getCard(topCardIndex, wildColour)

        content = `The current card is a **${topCard.join(" ")}**.\n`
        components = []
        isTurn = mod(turn, numPlayers) === playerIndex
        if (isTurn) {
          drawRequirement = game_states.get(channelId, 'draw_requirement');
          if (topCard[1] === "+4" && drawRequirement === 4) {
            content += "You must draw 4 cards."
            return await interaction.reply({
              content: content,
              components: [
                {
                  type: 'ACTION_ROW',
                  components: [
                    {
                      type: 'BUTTON',
                      style: 'PRIMARY',
                      label: "Draw 4",
                      custom_id: `uno-draw4`
                    }
                  ]
                }
              ],
              ephemeral: true
            })
          }
          if (drawRequirement) {
            content += `You must draw ${drawRequirement} if you cannot stack another +2.`
            components.push({
              type: 'ACTION_ROW',
              components: [
                {
                  type: 'BUTTON',
                  label: `Draw ${drawRequirement}`,
                  style: 'PRIMARY',
                  custom_id: `uno-draw${drawRequirement}`
                }
              ]
            })
          }
        }

        row = components.length;
        column = 0;
        let allDisabled = true;
        drawnCardIndex = game_states.get(channelId, 'drawn_card');
        for (let i = 0; i < hand.length; i++) {
          const cardIndex = hand[i];
          const card = getCard(cardIndex);
          if (column === 0) components.push({
            type: 'ACTION_ROW',
            components: []
          })
          const disabled = !isTurn || !isPlayable(card, topCard, drawRequirement);
          allDisabled = allDisabled && disabled
          components[row].components.push({
            type: 'BUTTON',
            label: card.join(" "),
            style: "SECONDARY",
            disabled: disabled,
            custom_id: `uno-play${(drawnCardIndex !== undefined) ? 'drawn' : ''}-${cardIndex}`
          })
          column++;
          if (column > 4) {
            column = 0;
            row++;
          }
        }

        if (drawnCardIndex !== undefined) {
          components.unshift({
            type: 'ACTION_ROW',
            components: [
              {
                type: 'BUTTON',
                label: 'End Turn',
                style: 'DANGER',
                custom_id: 'uno-end'
              }
            ]
          })
        }

        if (isTurn && !drawRequirement && allDisabled) {
          components.unshift({
            type: 'ACTION_ROW',
            components: [
              {
                type: 'BUTTON',
                label: 'Draw',
                style: 'PRIMARY',
                custom_id: 'uno-draw'
              }
            ]
          })
        }
        
        await interaction.reply({
          content: content,
          components: components.slice(0, 5),
          ephemeral: true
        })
        if (components.length > 5) {
          for (let i = 5; i < components.length; i += 5) {
            await interaction.followUp({
              components: components.slice(i, i + 5),
              ephemeral: true
            })
          }
        }
        return;
      case 'play':
      case 'playwild':
        if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
        if (!game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game hasn't started yet!", ephemeral: true});
        turn = game_states.get(channelId, 'turn');
        players = game_states.get(channelId, 'players')
        numPlayers = players.length
        playerIndex = game_states.get(channelId, 'players').indexOf(interaction.user.id);
        if (mod(turn, numPlayers) !== playerIndex) return await interaction.reply({content: "It isn't your turn!", ephemeral: true});

        [ game, actionType, chosenCardIndexString, chosenColour ] = custom_id.split('-')

        chosenCardIndex = parseInt(chosenCardIndexString)
        if (!game_states.includes(channelId, chosenCardIndex, `hands.${interaction.user.id}`)) return await interaction.reply({content: "That card isn't in your hand anymore.", ephemeral: true});
        
        chosenCard = getCard(chosenCardIndex, chosenColour);

        topCardIndex = game_states.get(channelId, 'discard.0');
        wildColour = game_states.get(channelId, 'wild_colour') ?? null;
        topCard = getCard(topCardIndex, wildColour);
        drawRequirement = game_states.get(channelId, 'draw_requirement');
        if (!isPlayable(chosenCard, topCard, drawRequirement)) return await interaction.reply({content: "You can't play that card!", ephemeral: true});

        if (chosenCard[0] === "wild" && !chosenColour) return await interaction.reply({
          content: "What colour should the wild card represent?",
          components: [
            {
              type: 'ACTION_ROW',
              components: colours.map(colour => ({
                type: 'BUTTON',
                style: 'PRIMARY',
                label: colour,
                custom_id: `uno-playwild-${chosenCardIndex}-${colour}`
              }))
            }
          ],
          ephemeral: true
        })
        drawnCardIndex = game_states.get(channelId, 'drawn_card');
        if (drawnCardIndex !== undefined) {
          content += `<@${interaction.user.id}> played a **${chosenCard.join(" ")}** after drawing it.`;
          game_states.delete(channelId, 'drawn_card');
        } else {
          content += `<@${interaction.user.id}> played a **${chosenCard.join(" ")}**.`
        }

        discardCard(channelId, interaction.user.id, chosenCardIndex)
        if (chosenColour) {
          game_states.set(channelId, chosenColour, 'wild_colour')
        } else {
          game_states.delete(channelId, 'wild_colour')
        }

        hand = game_states.get(channelId, `hands.${interaction.user.id}`)
        if (hand.length === 0) {
          content += `\n<@${interaction.user.id}> wins!`
          game_states.delete(channelId)
          return await interaction.reply({
            content: content,
            allowedMentions: {parse: []}
          })
        }
        if (hand.length === 1) {
          content += " **Uno!**"
        } else {
          content += ` They now have **${hand.length}** cards.`
        }

        if (chosenCard[1] === 'skip') {
          content += "\nThe next player's turn was skipped."
          incrementTurn(channelId);
        }

        if (chosenCard[1] === 'reverse') {
          game_states.set(channelId, !game_states.get(channelId, 'reversed'), 'reversed')
          content += "\nThe direction of play was reversed."
          if (numPlayers === 2) incrementTurn(channelId);
        }

        if (chosenCard[1].startsWith("+")) {
          plusNumber = parseInt(chosenCard[1][1])
          newDrawRequirement = (drawRequirement ?? 0) + plusNumber
          game_states.set(channelId, newDrawRequirement, 'draw_requirement');
          content += `\nThe next player must draw ${newDrawRequirement} cards`
          if (chosenCard[1][1] === '2') content += " or stack another +2"
          content += "."
        }
        break;
      default:
        if (!actionType.startsWith('draw')) return;
        if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
        if (!game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game hasn't started yet!", ephemeral: true});
        turn = game_states.get(channelId, 'turn');
        players = game_states.get(channelId, 'players')
        numPlayers = players.length
        playerIndex = game_states.get(channelId, 'players').indexOf(interaction.user.id);
        if (mod(turn, numPlayers) !== playerIndex) return await interaction.reply({content: "It isn't your turn!", ephemeral: true});

        [ game, actionType, chosenCardIndexString ] = custom_id.split('-')
        hand = game_states.get(channelId, `hands.${interaction.user.id}`)
        topCardIndex = game_states.get(channelId, 'discard.0');
        wildColour = game_states.get(channelId, 'wild_colour') ?? null;
        topCard = getCard(topCardIndex, wildColour);
        drawRequirement = game_states.get(channelId, 'draw_requirement');
        if (actionType !== 'draw') {
          if (!drawRequirement) return await interaction.reply({content: "There's no need to draw at the moment!", ephemeral: true});
          dealtCards = dealCards(channelId, interaction.user.id, drawRequirement);
          content += `<@${interaction.user.id}> drew ${dealtCards.length} card${dealtCards.length === 1 ? '' : 's'}`;
          if (dealtCards.length < drawRequirement) content += ` - there were not enough available to draw ${drawRequirement}`
          content += `. They now have **${hand.length}** cards.`
          game_states.delete(channelId, 'draw_requirement');
          await interaction.reply({content: `You drew: **${dealtCards.map(index => getCard(index).join(" ")).join("**, **")}**`, ephemeral: true});
          break;
        }
        const initialDrawnCardIndex = game_states.get(channelId, 'drawn_card');
        if (initialDrawnCardIndex === undefined && hand.some(cardIndex => isPlayable(getCard(cardIndex), topCard, drawRequirement))) return await interaction.reply({content: "You can't draw if you can play a card!", ephemeral: true});
        if (initialDrawnCardIndex === undefined) {
          [ drawnCardIndex ] = dealCards(channelId, interaction.user.id);
        } else {
          drawnCardIndex = initialDrawnCardIndex
        }
        if (drawnCardIndex !== undefined) {
          drawnCard = getCard(drawnCardIndex);

          if (initialDrawnCardIndex !== undefined || isPlayable(drawnCard, topCard, drawRequirement)) {
            if (!drawnCard) drawnCard = getCard(drawnCardIndex);
            game_states.set(channelId, drawnCardIndex, 'drawn_card')
            return await interaction.reply({
              content: `You drew a **${drawnCard.join(" ")}**.`,
              components: [
                {
                  type: 'ACTION_ROW',
                  components: [
                    {
                      type: 'BUTTON',
                      label: "Play",
                      style: "SUCCESS",
                      custom_id: `uno-play-${drawnCardIndex}`
                    },
                    {
                      type: 'BUTTON',
                      label: "End Turn",
                      style: "DANGER",
                      custom_id: `uno-end-${drawnCardIndex}`
                    }
                  ]
                }
              ],
              ephemeral: true
            })
          }
          await interaction.reply({content: `You drew a **${drawnCard.join(" ")}**.`, ephemeral: true});
        }
      case 'end':
        if (actionType === 'end') {
          if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
          if (!game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game hasn't started yet!", ephemeral: true});

          turn = game_states.get(channelId, 'turn');
          players = game_states.get(channelId, 'players')
          numPlayers = players.length
          playerIndex = game_states.get(channelId, 'players').indexOf(interaction.user.id);
          if (mod(turn, numPlayers) !== playerIndex) return await interaction.reply({content: "It isn't your turn!", ephemeral: true});

          if (!game_states.has(channelId, 'drawn_card')) return await interaction.reply({content: "You can't end your turn at the moment!", ephemeral: true})
          drawnCardIndex = game_states.get(channelId, 'drawn_card')
          game_states.delete(channelId, 'drawn_card')
        }

        if (!hand) hand = game_states.get(channelId, `hands.${interaction.user.id}`)
        if (drawnCardIndex !== undefined) {
          content = `<@${interaction.user.id}> drew a card. They now have **${hand.length}** cards.`
        } else {
          content = `<@${interaction.user.id}> tried to draw a card, but there were none available.`
        }
        players = game_states.get(channelId, 'players')
        numPlayers = players.length
        break;
    }
    incrementTurn(channelId);

    const nextTurn = game_states.get(channelId, 'turn');
    const nextPlayer = game_states.get(channelId, `players.${mod(nextTurn, numPlayers)}`);
    content += `\n<@${nextPlayer}> will play next.`;

    if (interaction.replied) {
      return await interaction.followUp({
        content: content,
        allowedMentions: {users: [nextPlayer]},
        components: [
          {
            type: 'ACTION_ROW',
            components: [view_hand_button]
          }
        ]
      })
    } else {
      return await interaction.reply({
        content: content,
        allowedMentions: {users: [nextPlayer]},
        components: [
          {
            type: 'ACTION_ROW',
            components: [view_hand_button]
          }
        ]
      })
    }
  }
};