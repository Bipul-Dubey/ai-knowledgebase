package config

import (
	"fmt"
	"os"

	pb "github.com/Bipul-Dubey/ai-knowledgebase/chats-service/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type GRPCClient struct {
	conn   *grpc.ClientConn
	client pb.InferenceClient
}

func NewGRPCClient() (*GRPCClient, error) {
	grpcHost := os.Getenv("GRPC_HOST")
	if grpcHost == "" {
		grpcHost = "localhost:50051"
	}

	conn, err := grpc.NewClient(grpcHost, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gRPC server: %w", err)
	}

	return &GRPCClient{
		conn:   conn,
		client: pb.NewInferenceClient(conn),
	}, nil
}

func (g *GRPCClient) GetClient() pb.InferenceClient {
	return g.client
}

func (g *GRPCClient) Close() error {
	return g.conn.Close()
}
