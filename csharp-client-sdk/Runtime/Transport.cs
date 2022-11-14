using System.Threading.Tasks;

namespace Hathora
{
    public interface Transport
    {

        public Task Connect(string stateId, string token);

        public Task WriteMessage(byte[] data);

        public Task<byte[]> ReadMessage();

        public bool IsReady();

        public Task Disconnect(int code);
    }
}
