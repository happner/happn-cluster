FROM ubuntu:14.04
MAINTAINER ig-grant

ARG NODE_VERSION=4.*

#### General ####
RUN apt-get update && apt-get install -y curl wget git git-core curl build-essential

#### Install NVM (Node Version Manager) ####

RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash
RUN command -v nvm
RUN nvm run node --$NODE_VERSION

#### Clone Github repos ####

RUN mkdir -p home
RUN git clone https://github.com/happner/happn-cluster.git /home/happn-cluster
RUN cd /home/happn-cluster && \
    npm install

### Set up working directory

WORKDIR /home/happn-cluster

EXPOSE 8005

CMD ["/bin/bash"]

# To build: sudo docker build --build-arg NODE_VERSION=4.* -t happner/happn-cluster:v1 .

# To run (PRODUCTION): sudo docker run -p 8005:8005 -it --rm happner/happn-cluster:v1

# Inspect: sudo docker inspect [container_id]
# Delete all containers: sudo docker rm $(docker ps -a -q)
# Delete all images: sudo docker rmi $(docker images -q)
# Connect to running container: sudo docker exec -it [container_id] bash
# Attach to running container: sudo docker attach [container_id]
# Detach from running container without stopping process: Ctrl-p Ctrl-q
# Restart Docker service: sudo service docker.io restart
