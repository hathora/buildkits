using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Hathora
{
    public class Client
    {
        private readonly string appId;
        private readonly string coordinatorHost;
        private readonly HttpClient httpClient;

        public Client(string appId, string coordinatorHost = "coordinator.hathora.dev")
        {
            this.appId = appId;
            this.coordinatorHost = coordinatorHost;
            this.httpClient = new HttpClient();
        }

        public async Task<string> LoginAnonymous()
        {
            HttpResponseMessage loginResponse = await httpClient.PostAsync($"https://{coordinatorHost}/{appId}/login/anonymous", null);
            string loginBody = await loginResponse.Content.ReadAsStringAsync();
            LoginResponse login = JsonConvert.DeserializeObject<LoginResponse>(loginBody);
            return login.token;
        }

        public async Task<string> LoginNickname()
        {
            HttpResponseMessage loginResponse = await httpClient.PostAsync($"https://{coordinatorHost}/{appId}/login/nickname", null);
            string loginBody = await loginResponse.Content.ReadAsStringAsync();
            LoginResponse login = JsonConvert.DeserializeObject<LoginResponse>(loginBody);
            return login.token;
        }

        public async Task<string> LoginGoogle()
        {
            HttpResponseMessage loginResponse = await httpClient.PostAsync($"https://{coordinatorHost}/{appId}/login/google", null);
            string loginBody = await loginResponse.Content.ReadAsStringAsync();
            LoginResponse login = JsonConvert.DeserializeObject<LoginResponse>(loginBody);
            return login.token;
        }

        public async Task<string> Create(string token, byte[] body)
        {
            HttpRequestMessage createRequest = new HttpRequestMessage(HttpMethod.Post, $"https://{coordinatorHost}/{appId}/create");
            createRequest.Content = new ByteArrayContent(body);
            createRequest.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            createRequest.Headers.Add("Authorization", token);
            HttpResponseMessage createResponse = await httpClient.SendAsync(createRequest);
            string createBody = await createResponse.Content.ReadAsStringAsync();
            CreateResponse create = JsonConvert.DeserializeObject<CreateResponse>(createBody);
            return create.stateId;
        }

        public async Task<Transport> Connect(string token, string stateId, TransportType transportType)
        {
            switch (transportType)
            {
                case TransportType.WebSocket:
                default:
                    WebsocketTransport result = new WebsocketTransport(appId, coordinatorHost);
                    await result.Connect(stateId, token);
                    return result;
            }
        }

        public enum TransportType
        {
            WebSocket,
        }

        // Source: https://stackoverflow.com/a/39280625/834459
        public static string GetUserFromToken(string token)
        {
            var parts = token.Split('.');
            if (parts.Length > 2)
            {
                var decode = parts[1];
                var padLength = 4 - decode.Length % 4;
                if (padLength < 4)
                {
                    decode += new string('=', padLength);
                }
                var bytes = System.Convert.FromBase64String(decode);
                string json = System.Text.ASCIIEncoding.ASCII.GetString(bytes);
                Token jwt = JsonConvert.DeserializeObject<Token>(json);
                return jwt.id;
            }

            return "";
        }
    }

    class LoginResponse
    {
        public string token;
    }

    class Token
    {
        public string type;
        public string id;
        public string name;
        public int iat;
    }

    class CreateResponse
    {
        public string stateId;
    }
}
