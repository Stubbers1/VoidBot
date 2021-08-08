module.exports = {
	name: 'stats',
	description: 'Get game stats for a user.',
	cooldown: 3,
  options: [
    {
      name: 'user',
      type: 'USER',
      description: "The user to display stats for.",
      required: true
    }
  ]
};