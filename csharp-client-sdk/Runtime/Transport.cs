using System.Threading.Tasks;

namespace Hathora
{
    public interface Transport
    {

        public Task Connect(string stateId, string token);

        public Task Write(byte[] data);

        public Task<byte[]> Read();

        public bool IsReady();

        public Task Disconnect(int code);
    }
}