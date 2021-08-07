module.exports = {
	name: 'kick',
	description: 'Kick a member from the server',
	cooldown: 0,
  guild_only: true,
  permissions: {
    member: ['KICK_MEMBERS'],
    bot: ['KICK_MEMBERS']
  },
  options: [
    {
      name: 'user', 
      type: 'USER',
      description: "The user to kick",
      required: true
    },
    {
      name: 'reason', 
      type: 'STRING',
      description: "The reason for the ban"
    }
  ],
	async execute(interaction) {
    await interaction.defer({ephemeral: true})
    const user = interaction.options.getUser('user', true)
    const guild = interaction.guild
    const member = guild?.members.resolve(user)
    if (!member) return await interaction.editReply(`User not found.`);
    if (interaction.guild.ownerId != interaction.member.id && member.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0) return await interaction.editReply(`You cannot kick that user.`);
    if (!member.kickable) return await interaction.editReply(`I cannot kick that member.`);
    const reason = interaction.options.getString('reason')
    await member.kick(`${interaction.user.tag}: ${reason ?? 'No reason given'}`)
		return await interaction.editReply(`Kicked <@${user.id}>`) || true;
	}
};