using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Hathora
{
    public class WebsocketTransport : Transport
    {

        private string appId;
        private string coordinatorHost;
        private ClientWebSocket webSocket;

        public WebsocketTransport(string appId, string coordinatorHost = "coordinator.hathora.dev")
        {
            this.appId = appId;
            this.coordinatorHost = coordinatorHost;
            this.webSocket = new ClientWebSocket();
        }

        public async Task Connect(string stateId, string token)
        {
            await webSocket.ConnectAsync(new Uri($"wss://{coordinatorHost}/connect/{appId}"), CancellationToken.None);
            var bytesToSend = Encoding.UTF8.GetBytes($"{{\"token\": \"{token}\", \"stateId\": \"{stateId}\"}}");
            await webSocket.SendAsync(bytesToSend, WebSocketMessageType.Binary, true, CancellationToken.None);
        }

        public async Task<byte[]> ReadMessage()
        {
            List<byte> result = new List<byte>();
            ArraySegment<byte> bytesReceived = new ArraySegment<byte>(new byte[1024]);
            bool doneReading = false;
            while (!doneReading)
            {
                WebSocketReceiveResult readResult = await webSocket.ReceiveAsync(bytesReceived, CancellationToken.None);
                result.AddRange(bytesReceived.Slice(0, readResult.Count));
                doneReading = readResult.EndOfMessage;
            }
            return result.ToArray();
        }

        public async Task WriteMessage(byte[] data)
        {
            await webSocket.SendAsync(data, WebSocketMessageType.Binary, true, CancellationToken.None);
        }

        public bool IsReady()
        {
            return webSocket.State == WebSocketState.Open;
        }

        public async Task Disconnect(int code)
        {
            WebSocketCloseStatus closeStatus = (WebSocketCloseStatus)code;
            await webSocket.CloseAsync(closeStatus, null, CancellationToken.None);
        }
    }
}
