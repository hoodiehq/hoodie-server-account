var Boom = require('boom')

module.exports = function (server, options, next) {
  var couchUrl = options.couchdb || options.adapter.location
  var prefix = options.prefix || ''

  var request = require('request').defaults({
    json: true,
    baseUrl: couchUrl,
    timeout: 10000 // 10 seconds
  })

  server.route([{
    method: 'GET',
    path: prefix + '/session',
    handler: function (_req, reply) {
      var headers = _req.headers
      var authorization = headers.authorization

      if (!authorization) {
        return reply(Boom.notFound())
      }
      if (authorization.substr(0, 7) !== 'Bearer ') {
        return reply(Boom.notFound())
      }

      var bearerToken = headers.authorization.substr(7)
      request.get({
        url: '/_session',
        headers: {
          cookie: 'AuthSession=' + bearerToken
        }
      }, function (error, response, body) {
        if (error) {
          return reply(Boom.wrap(error))
        }

        if (response.statusCode >= 400) {
          return reply(Boom.create(response.statusCode, body.reason))
        }

        if (body.userCtx.name === null) {
          return reply(Boom.notFound())
        }

        reply({
          id: bearerToken
        })
      })
    }
  }, {
    method: 'PUT',
    path: prefix + '/session',
    handler: function (_req, reply) {
      var server = _req.connection.server
      var payload = _req.payload
      request.post({
        url: '/_session',
        form: {
          name: payload.username,
          password: payload.password
        }
      }, function (error, response, body) {
        if (error) {
          return reply(Boom.wrap(error))
        }

        if (response.statusCode >= 400) {
          return reply(Boom.create(response.statusCode, body.reason))
        }

        var bearerToken = response.headers['set-cookie'][0].match(/AuthSession=([^;]+)/)

        if (!bearerToken) {
          server.log(['error', 'couchdb'], '"AuthSession" not found in set-cookie header of POST /_session response')
          return reply(Boom.badImplementation())
        }

        reply({
          id: bearerToken.pop()
        }).code(201)
      })
    }
  }, {
    method: 'DELETE',
    path: prefix + '/session',
    handler: function (_req, reply) {
      var headers = _req.headers
      var authorization = headers.authorization
      var options = {
        url: '/_session'
      }

      if (authorization && authorization.substr(0, 7) === 'Bearer ') {
        var bearerToken = authorization.substr(7)
        options.headers = {
          cookie: 'AuthSession=' + bearerToken
        }
      }

      request.del(options, function (error, response, body) {
        if (error) {
          return reply(Boom.wrap(error))
        }

        if (response.statusCode >= 400) {
          return reply(Boom.create(response.statusCode, body.reason))
        }

        reply().code(204)
      })
    }
  }])

  next()
}

module.exports.attributes = {
  name: 'account-api-session'
}