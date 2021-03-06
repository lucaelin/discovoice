all:
	docker build . -t discovoice
	docker run -d --restart always --name discovoice discovoice

upgrade:
	git pull
	docker build . -t discovoice
	docker stop discovoice
	docker rm discovoice
	docker run -d --restart always --name discovoice discovoice
