import grpc
from concurrent import futures
import sys
import os

# Add the proto directory specifically to Python path
proto_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'proto')
if proto_dir not in sys.path:
    sys.path.insert(0, proto_dir)

# Now import directly
import ai_service_pb2 as pb
import ai_service_pb2_grpc as pb_grpc

class InferenceServicer(pb_grpc.InferenceServicer):
    def Predict(self, request, context):
        result = request.input 
        return pb.PredictReply(output=result)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    pb_grpc.add_InferenceServicer_to_server(InferenceServicer(), server)
    server.add_insecure_port("[::]:50051")
    print("gRPC server starting on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
