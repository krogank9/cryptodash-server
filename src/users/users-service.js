const bcrypt = require('bcryptjs')
const xss = require('xss')

const UsersService = {
  getById(knex, id) {
    id = parseInt(id) || 0
    return knex.from('users').select('*').where('id', id).first()
  },
  hasUserWithUserName(db, user_name) {
    return db('users')
      .where({ user_name })
      .first()
      .then(user => !!user)
  },
  insertUser(db, newUser) {
    return db
      .insert(newUser)
      .into('users')
      .returning('*')
      .then(([user]) => user)
  },
  updateProfilePicture(db, userId, newProfilePic) {
    console.log('updating profile picture')
    console.log(newProfilePic)
    return db('users')
            .where({ id: userId })
            .update({profile_picture: newProfilePic})
  },
  deleteUser(db, userId) {
    return db('users')
            .where({ id: userId })
            .delete()
  },
  // Perform validation on username to allow only certain characters/combos
  validateUsername(username) {
    const lettersNumbersUnderscore = /^\w+$/;
    const doubleUnderscores = /(?!.*__.*)/;
    const startsWithUnderscore = /^_.*/;
    const endsWithUnderscore = /.*_$/;
    if (!lettersNumbersUnderscore.test(username)) {
      return 'Username may only contain letters, numbers, and underscores.'
    }
    else if (username.indexOf("__") !== -1) {
      return 'Username may not contain 2 underscores in a row'
    }
    else if (startsWithUnderscore.test(username) || endsWithUnderscore.test(username)) {
      return 'Username may not start or end with an underscore'
    }
    return null
  },
  // Perform validation on password to make sure it's strong enough
  validatePassword(password) {
    if (password.length < 8) {
      return 'Password must be longer than 8 characters'
    }
    if (password.length > 72) {
      return 'Password must be less than 72 characters'
    }
    if (password.startsWith(' ') || password.endsWith(' ')) {
      return 'Password must not start or end with empty spaces'
    }
    return null
  },
  hashPassword(password) {
    return bcrypt.hash(password, 12)
  },
  serializeUser(user) {
    return {
      id: user.id,
      userName: xss(user.user_name),
      dateCreated: new Date(user.date_created),
    }
  },
}

module.exports = UsersService
