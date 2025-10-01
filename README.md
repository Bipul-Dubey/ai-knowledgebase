# ai-knowledgebase

Install protoc 3.25+ from the official release page and add protoc to PATH.

Add Go plugins once (per machine):
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest.

In the Python venv install gRPC tooling:
pip install grpcio grpcio-tools.

Ensure $(go env GOPATH)/bin is on PATH so the plugins are discoverable.
export PATH="$PATH:$(go env GOPATH)/bin"

<!-- generate protoc files -->

protoc -I proto proto/ai_service.proto \
 --go_out=chats-service/proto \
 --go-grpc_out=chats-service/proto \
 --go_opt=paths=source_relative \
 --go-grpc_opt=paths=source_relative

python3 -m grpc_tools.protoc -I proto \
 --python_out=ai-service/proto \
 --grpc_python_out=ai-service/proto \
 proto/ai_service.proto
