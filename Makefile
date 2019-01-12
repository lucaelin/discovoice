all:
	docker build . -t discovoice
	docker run -d --name discovoice discovoice

upgrade:
	docker build . -t discovoice
	docker stop discovoice
	docker rm discovoice
	docker run -d --name discovoice discovoice
