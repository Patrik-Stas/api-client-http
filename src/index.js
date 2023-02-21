const axios = require('axios')
const uuid = require('uuid')

async function returnNullFor404 (axiosCallableReturningResponseData) {
  try {
    const data = await axiosCallableReturningResponseData()
    return data
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null
    } else throw err
  }
}

function createApiHttpClient (axiosInstance, loggingOptions, headersOverride) {
  const { logDataPayloads, logRequestHeaders, logger } = loggingOptions
  const authentication = {}
  const jestTestReqCounter = {}

  if (!axiosInstance) {
    axiosInstance = axios.create({})
  }

  function getOverrideHeaders () {
    if (!headersOverride) {
      return {}
    }
    if (typeof headersOverride === 'function') {
      return headersOverride()
    }
    return headersOverride
  }

  function setAuthorizationHeader (value) {
    authentication.Authorization = value
  }

  function setXAuthorizationHeader (value) {
    authentication['X-Authorization'] = value
  }

  function generateRequestId () {
    if (global.expect) { // global.expect is defined when running within jest context
      const { currentTestName } = global.expect.getState()
      if (currentTestName) {
        if (jestTestReqCounter[currentTestName] === undefined) {
          jestTestReqCounter[currentTestName] = 1
        } else {
          jestTestReqCounter[currentTestName] += 1
        }
        return `${currentTestName}-${jestTestReqCounter[currentTestName]}`
      }
    }
    return uuid.v4()
  }

  async function _sendRequest (method, url, data, requestHeaders, axiosOptions) {
    const logPrefix = `${method.toUpperCase()} ${url}`
    const includeRequestIdHeader = false
    let headers = includeRequestIdHeader ? { 'X-Request-ID': generateRequestId() } : {}

    headers = {
      ...headers,
      ...getOverrideHeaders(),
      ...authentication,
      ...requestHeaders
    }
    if (logger && logDataPayloads) {
      logger.debug(`[Request] ${logPrefix}\nSending request: ${JSON.stringify(data, null, 2)}`)
    }
    if (logger && logRequestHeaders) {
      logger.debug(`[Request] ${logPrefix}\nSending headers: ${JSON.stringify(headers, null, 2)}`)
    }
    let res
    try {
      res = await axiosInstance.request({ url, data, headers, method, ...axiosOptions })
    } catch (err) {
      if (logger) {
        if (err.response) {
          logger.error(`[Response] ${logPrefix} Received error status code: ${err.response.status} ${err.response.statusText}\nResponse headers:${JSON.stringify(err.response.headers, null, 2)}\nResponse body: ${JSON.stringify(err.response.data, null, 2)}`)
        } else {
          logger.error(`[Response] ${logPrefix} Error calling the endpoint: ${err.stack}`)
        }
      }
      throw err
    }
    if (logger && logDataPayloads) {
      logger.debug(`[Response] ${logPrefix} \nStatus code: ${res.status}\nResponse body: ${JSON.stringify(res.data, null, 2)}`)
    }
    const { headers: responseHeaders, data: responseData } = res
    return { responseHeaders, responseData }
  }

  async function getRequest (url, headers, axiosOptions) {
    const { responseData } = await _sendRequest('get', url, headers, axiosOptions)
    return responseData
  }

  async function postRequest (url, payload, headers, axiosOptions) {
    const { responseData } = await _sendRequest('post', url, payload, headers, axiosOptions)
    return responseData
  }

  async function putRequest (url, payload, headers, axiosOptions) {
    const { responseData } = await _sendRequest('put', url, payload, headers, axiosOptions)
    return responseData
  }

  async function deleteRequest (url, headers, axiosOptions) {
    const { responseData } = await _sendRequest('delete', url, headers, axiosOptions)
    return responseData
  }

  return {
    returnNullFor404,
    getRequest,
    postRequest,
    putRequest,
    deleteRequest,
    setAuthorizationHeader,
    setXAuthorizationHeader
  }
}

module.exports = {
  createApiHttpClient,
  returnNullFor404
}
