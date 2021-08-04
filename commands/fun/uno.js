const Enmap = require('enmap');

const colours = ["red", "yellow", "blue", "green"]
const names = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+2", "reverse", "skip"]
const wildNames = ["card", "+4"]

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

// get a card based on its index within the deck
function getCard(index, wildColour) {
  if (index < 100) {
    return [colours[(index % 4)], names[Math.floor(((index % 25) + 1) / 2)]]
  }
  const card = ["wild", wildNames[(index % 2)]]
  if (wildColour) card.push(wildColour)
  return card
}

// get how a card should be displayed
function getName(card) {
  let name = card.slice(0, 2).join(" ")
  if (card.length > 2) {
    name += "(" + card.slice(2).join(" ") + ")"
  }
  return name
}

// check if a card is playable based on the card, the top card in the discard and if there is a requirement to draw cards at the moment
function isPlayable(channelId, card) {
  const topCard = getTopCard(channelId);
  const drawRequirement = game_states.get(channelId, 'draw_requirement');
  if (drawRequirement && card[1] !== "+2") return false;
  if (card[0] === "wild" || card[0] === topCard[0] || card[1] === topCard[1]) return true;
  if (topCard[0] === "wild" && card[0] === topCard[2]) return true;
  return false;
}

// increment the turn counter (taking reverse into account)
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

// deal n random cards from the deck to a player
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

function getTopCard(channelId) {
  const topCardIndex = game_states.get(channelId, 'discard.0');
  const wildColour = game_states.get(channelId, 'wild_colour');
  return getCard(topCardIndex, wildColour);
}

// discard a card from a player's hand
function discardCard(channelId, playerId, cardIndex) {
  game_states.remove(channelId, cardIndex, `hands.${playerId}`)
  const discard = game_states.observe(channelId, 'discard')
  discard.unshift(cardIndex) // add to the start discard
}

function startGame(channelId) {
  game_states.set(channelId, 0, 'turn')
  game_states.set(channelId, false, 'reversed')

  const topCardIndex = getRandomInt(0, 4) * 25 + getRandomInt(0, 19);
  game_states.set(channelId, [topCardIndex], 'discard')

  game_states.set(channelId, Array.from(Array(108).keys()).filter(card => card !== topCardIndex), 'deck');

  const players = game_states.observe(channelId, 'players')
  shuffle(players)

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i]
    game_states.set(channelId, [], `hands.${playerId}`)
    dealCards(channelId, playerId, 7)
  }

  return players
}

function endGame(channelId) {
  const players = game_states.get(channelId, 'players')

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i]
    client.user_data.inc(playerId, 'uno.played')
    if (game_states.get(channelId, `hands.${playerId}`).length === 0) client.user_data.inc(playerId, 'uno.wins');
  }

  game_states.delete(channelId)
}

// various button structures
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

    game_states.set(channelId, {owner: interaction.user.id, players: []}) // set the game state to pre-game state
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

    const actionType = custom_id.split('-')[1]
    switch (actionType) {
      case 'join': { // someone joins the game
        if (game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're already in this game!", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});

        const players = game_states.get(channelId, 'players')
        const numPlayers = players.length

        if (numPlayers >= 10) return await interaction.reply({content: "There are already 10 players in this game.", ephemeral: true})

        game_states.push(channelId, interaction.user.id, 'players')

        return await interaction.reply({content: `<@${interaction.user.id}> joined the game!`, allowedMentions: {parse: []}});
      }
      case 'leave': // someone leaves the game
        if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        
        game_states.remove(channelId, interaction.user.id, 'players')

        return await interaction.reply({content: `<@${interaction.user.id}> left the game.`, allowedMentions: {parse: []}});
      case 'start': // starting the game
        if (game_states.get(channelId, 'owner') !== interaction.user.id && !interaction.member.permissionsIn(interaction.channel).has('MANAGE_CHANNELS')) return await interaction.reply({content: "Only the user who created the game can start it.", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        
        let players = game_states.get(channelId, 'players')
        const numPlayers = players.length
        if (2 > numPlayers || numPlayers > 10) return await interaction.reply({content: "An Uno game must have 2-10 players to start.", ephemeral: true});
        players = startGame(channelId)
        const topCard = getTopCard(channelId)

        await interaction.reply({
          content: `<@${interaction.user.id}> started the game. Turn order: <@${players.join('>, <@')}>.\n<@${players[0]}> will play first, and the top card is a **${getName(topCard)}**.`,
          components: [
            {
              type: 'ACTION_ROW',
              components: [view_hand_button]
            }
          ],
          allowedMentions: {users: players}
        })
        return;
      case 'cancel': // cancelling the game
        if (game_states.get(channelId, 'owner') !== interaction.user.id && !interaction.member.permissionsIn(interaction.channel).has('MANAGE_CHANNELS')) return await interaction.reply({content: "Only the user who created the game can cancel it.", ephemeral: true});
        if (game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game has already started!", ephemeral: true});
        
        game_states.delete(channelId)
        return await interaction.reply(`The game was cancelled by <@${interaction.user.id}>.`)
    }
    if (!game_states.includes(channelId, interaction.user.id, 'players')) return await interaction.reply({content: "You're not in this game!", ephemeral: true});
    if (!game_states.has(channelId, 'turn')) return await interaction.reply({content: "The game hasn't started yet!", ephemeral: true});
    const turn = game_states.get(channelId, 'turn');
    const players = game_states.get(channelId, 'players')
    const numPlayers = players.length
    const playerIndex = game_states.get(channelId, 'players').indexOf(interaction.user.id);
    const isTurn = mod(turn, numPlayers) === playerIndex
    if (actionType === 'hand') {
      const hand = game_states.get(channelId, `hands.${interaction.user.id}`);
      const topCard = getTopCard(channelId)

      let content = `The current card is a **${getName(topCard)}**.\n`
      const components = []
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
      const drawnCardIndex = game_states.get(channelId, 'drawn_card');
      for (let i = 0; i < hand.length; i++) {
        const cardIndex = hand[i];
        const card = getCard(cardIndex);
        if (column === 0) components.push({
          type: 'ACTION_ROW',
          components: []
        })
        const disabled = !isTurn || !isPlayable(channelId, card);
        allDisabled = allDisabled && disabled
        components[row].components.push({
          type: 'BUTTON',
          label: getName(card),
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
    }
    // the following actions (play, draw) must occur on the player's turn
    if (!isTurn) return await interaction.reply({content: "It isn't your turn!", ephemeral: true});
    let content = ""
    let hand, drawnCardIndex;
    switch (actionType) {
      case 'play': { // someone plays a card
        const [ , , chosenCardIndexString, chosenColour ] = custom_id.split('-')

        const chosenCardIndex = parseInt(chosenCardIndexString)
        if (!game_states.includes(channelId, chosenCardIndex, `hands.${interaction.user.id}`)) return await interaction.reply({content: "That card isn't in your hand anymore.", ephemeral: true});
        
        const chosenCard = getCard(chosenCardIndex, chosenColour);

        const topCard = getTopCard(channelId);
        const drawRequirement = game_states.get(channelId, 'draw_requirement');
        if (!isPlayable(channelId, topCard)) return await interaction.reply({content: "You can't play that card!", ephemeral: true});

        if (chosenCard[0] === "wild" && !chosenColour) return await interaction.reply({
          content: "What colour should the wild card represent?",
          components: [
            {
              type: 'ACTION_ROW',
              components: colours.map(colour => ({
                type: 'BUTTON',
                style: 'PRIMARY',
                label: colour,
                custom_id: `uno-play-${chosenCardIndex}-${colour}`
              }))
            }
          ],
          ephemeral: true
        })
        
        drawnCardIndex = game_states.get(channelId, 'drawn_card');
        if (drawnCardIndex !== undefined) {
          content += `<@${interaction.user.id}> played a **${getName(chosenCard)}** after drawing it.`;
          game_states.delete(channelId, 'drawn_card');
        } else {
          content += `<@${interaction.user.id}> played a **${getName(chosenCard)}**.`
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
          endGame(channelId)
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

        // handle special cards
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
      }
      default: // someone draws a card
        if (!actionType.startsWith('draw')) return await interaction.reply({content: "That button isn't what I expected.", ephemeral: true}); // if someone presses an old button it could have a different custom id - ignore it

        hand = game_states.get(channelId, `hands.${interaction.user.id}`)
        const drawRequirement = game_states.get(channelId, 'draw_requirement');

        if (actionType !== 'draw') { // draw 2+ cards (due to +2 or +4 cards)
          if (!drawRequirement) return await interaction.reply({content: "There's no need to draw at the moment!", ephemeral: true});
          if (actionType.slice(4) !== drawRequirement.toString()) return await interaction.reply({content: "That doesn't match the current draw requirement - press \"View Hand\" again.", ephemeral: true});
          const dealtCards = dealCards(channelId, interaction.user.id, drawRequirement);
          content += `<@${interaction.user.id}> drew ${dealtCards.length} card${dealtCards.length === 1 ? '' : 's'}`;
          if (dealtCards.length < drawRequirement) content += ` because there were not enough available to draw ${drawRequirement}`
          content += `. They now have **${hand.length}** cards.`
          game_states.delete(channelId, 'draw_requirement');
          await interaction.reply({content: `You drew: **${dealtCards.map(index => getName(getCard(index))).join("**, **")}**`, ephemeral: true});
          break;
        }
        const initialDrawnCardIndex = game_states.get(channelId, 'drawn_card');
        if (initialDrawnCardIndex === undefined && hand.some(cardIndex => isPlayable(channelId, getCard(cardIndex)))) return await interaction.reply({content: "You can't draw if you can play a card!", ephemeral: true});
        if (initialDrawnCardIndex === undefined) {
          [ drawnCardIndex ] = dealCards(channelId, interaction.user.id);
        } else {
          drawnCardIndex = initialDrawnCardIndex
        }
        if (drawnCardIndex !== undefined) {
          const drawnCard = getCard(drawnCardIndex);
          if (initialDrawnCardIndex !== undefined || isPlayable(channelId, drawnCard)) {
            game_states.set(channelId, drawnCardIndex, 'drawn_card')
            return await interaction.reply({
              content: `You drew a **${getName(drawnCard)}**.`,
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
          await interaction.reply({content: `You drew a **${getName(drawnCard)}**.`, ephemeral: true});
        }
      case 'end': // someone ends their turn after drawing a card
        if (actionType === 'end') {
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
        break;
    }
    incrementTurn(channelId); // increment the turn count

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