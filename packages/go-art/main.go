package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{}

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		upgrader.CheckOrigin = func(r *http.Request) bool { return true }
		// upgrade to websocket
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Print("upgrade failed", err)
			return
		}
		defer connection.Close()
		for {
			mt, message, err := connection.ReadMessage() //
			log.Println("mt", mt)
			if err != nil {
				log.Println("read failure", err)
				break
			}
			var input map[string]interface{}
			json.Unmarshal(message, &input)
			log.Println(input)
		}
	})

	http.ListenAndServe(":6060", nil)

}
