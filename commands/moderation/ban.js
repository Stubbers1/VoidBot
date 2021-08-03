module.exports = {
	name: 'ban',
	description: 'Ban a member from the server',
	cooldown: 0,
  guild_only: true,
  permissions: {
    member: ['BAN_MEMBERS'],
    bot: ['BAN_MEMBERS']
  },
  options: [
    {
      name: 'user', 
      type: 'USER',
      description: "The user to ban",
      required: true
    },
    {
      name: 'days', 
      type: 'INTEGER',
      description: "Number of days of messages to delete"
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
    if (interaction.guild.ownerId != interaction.member.id && member.roles.highest.comparePositionTo(interaction.member.roles.highest) >= 0) return await interaction.editReply(`You cannot ban that user.`);
    if (!member.bannable) return await interaction.editReply(`I cannot ban that member.`);
    const days = interaction.options.getString('days')
    const reason = interaction.options.getString('reason')
    await member.ban({days: days ?? undefined, reason: `${interaction.user.tag}: ${reason ?? 'No reason given'}`})
		await interaction.editReply(`Banned <@${user.id}>`);
	}
};